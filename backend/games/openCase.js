const User = require("../models/User");
const Case = require("../models/Case");
const badges = require("../utils/badges");
const realtime = require("../utils/realtime");
const { calculateLevelFromXp, recordTransaction, runAtomic, TX, WITHOUT_INVENTORY } = require("../utils/economy");
const referrals = require("../utils/referrals");
const fandom = require("../utils/fandom");
const { addUniqueInfoToItem, toInventoryEntry } = require("../utils/caseOpening");
const { buildRangeTable } = require("../utils/caseRanges");
const { roll, pickFromRanges, TOTAL } = require("../utils/provablyFair");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const { sellValue, recomputeCaseValues } = require("../utils/itemValue");

const MAX_PER_OPEN = 5;

// a refusal the caller turns into its own kind of answer: an http status on the site, an
// embed in discord. nothing here knows which.
const no = (status, message) => ({ ok: false, status, message });

// the whole opening: reserve the nonces, draw, charge, hand the items over, record the
// audit rolls, announce it. lifted out of the route so the discord bot opens a case
// through this exact path rather than a second one that drifts from it.
//
// `user` is a User document without its inventory, which is what isAuthenticated hands
// the route and what the bot loads for itself. `source` rides along to the live feed, so
// a drop can say where it came from.
async function openCase({ user, caseId, quantity, grantId = null, source = null }) {
  const winningItems = [];
  let caseData = await Case.findById(caseId).populate("items");

  if (!caseData) return no(404, "Case not found");
  if (!user) return no(404, "User not found");

  if (!Number.isInteger(quantity)) return no(400, "Quantity to open must be an integer");
  if (quantity > MAX_PER_OPEN) return no(400, `You can only open up to ${MAX_PER_OPEN} cases at a time`);
  if (quantity < 1) return no(400, "You need to open at least 1 case");

  // a daily-gift grant pays for openings of one specific case and nothing else, so a
  // cheap win cannot be spent on the dearest case in the same category
  let grant = null;
  if (grantId) {
    grant = (user.freeOpens || []).find((g) => g.grantId === grantId);
    if (!grant) return no(404, "Gift not found");
    if (String(grant.caseId) !== String(caseData._id)) return no(400, "That gift is for a different case");
    if (new Date(grant.expiresAt) <= new Date()) return no(400, "That gift has expired");
    if (grant.remaining < quantity) return no(400, "That gift has fewer openings left");
  }

  const cost = grant ? 0 : caseData.price * quantity;

  // reserve the nonces atomically up front (never rolled back), then derive each
  // item from the case's committed range table (provably fair, one draw per open)
  const reserved = await seeds.reserveNonces(user._id, quantity);

  // self-heal: materialize + commit this case's config on first open if it has
  // none yet, so the roll stays verifiable even if the backfill hasn't run
  if (!caseData.rangeTable || !caseData.rangeTable.length) {
    await recomputeCaseValues(caseData._id);
    caseData = await Case.findById(caseId).populate("items");
  }
  let rangeTable = caseData.rangeTable;
  let configHash = caseData.configHash;
  const configVersion = caseData.configVersion || 0;
  if (!rangeTable || !rangeTable.length) {
    const built = buildRangeTable(caseData); // safety net (e.g. a case with no items)
    rangeTable = built.rangeTable;
    configHash = built.configHash;
  }

  const draws = [];
  for (let i = 0; i < quantity; i++) {
    const nonce = reserved.startNonce + i;
    const rollValue = roll(reserved.serverSeed, reserved.clientSeed, nonce); // 1..TOTAL
    const picked = pickFromRanges(rollValue, rangeTable);
    const sourceItem = caseData.items.find((it) => String(it._id) === String(picked.itemId));
    const itemWithUniqueId = addUniqueInfoToItem(sourceItem);
    winningItems.push(itemWithUniqueId);
    draws.push({ nonce, roll: rollValue, itemId: picked.itemId, uniqueId: itemWithUniqueId.uniqueId });
  }

  // charge the cost, add the items and write the ledger row together: a failed row
  // rolls the charge back, so the player is never charged without a record
  const updatedUser = await runAtomic(async (session) => {
    const filter = { _id: user._id, walletBalance: { $gte: cost } };
    const update = {
      $inc: { walletBalance: -cost, xp: cost * 5 },
      $push: { inventory: { $each: winningItems.map(toInventoryEntry) } },
    };
    // the push has just made this inventory bigger; handing it back would cost more
    // than the opening did
    const options = { new: true, projection: WITHOUT_INVENTORY, session };

    // spend the openings in the same update that hands over the items, and require
    // the count to still cover it, so two concurrent opens cannot overdraw one grant
    if (grant) {
      filter.freeOpens = {
        $elemMatch: { grantId: grant.grantId, remaining: { $gte: quantity } },
      };
      update.$inc["freeOpens.$[g].remaining"] = -quantity;
      options.arrayFilters = [{ "g.grantId": grant.grantId, "g.remaining": { $gte: quantity } }];
    }

    const u = await User.findOneAndUpdate(filter, update, options);
    if (!u) return null;
    // a gift open moves no coins, so it gets no ledger row: the ledger records
    // balance changes and a zero one would only be noise
    if (cost > 0) {
      await recordTransaction(
        {
          userId: user._id,
          type: TX.CASE_OPEN,
          direction: "debit",
          amount: cost,
          balanceAfter: u.walletBalance,
          meta: { caseId: caseData._id, caseTitle: caseData.title, quantity, source: source || undefined },
        },
        session
      );
    }
    return u;
  });

  if (!updatedUser) return no(400, "Insufficient balance");

  // record one provably-fair audit roll per open (after the charge commits)
  const rollIds = [];
  for (const d of draws) {
    const rec = await rolls.recordRoll({
      game: "case",
      userId: user._id,
      seedId: reserved.seedId,
      clientSeed: reserved.clientSeed,
      serverSeedHash: reserved.serverSeedHash,
      nonce: d.nonce,
      roll: d.roll,
      total: TOTAL,
      caseId: caseData._id,
      caseConfigVersion: configVersion,
      caseConfigHash: configHash,
      itemId: d.itemId,
      uniqueId: d.uniqueId,
    });
    rollIds.push(rec.rollId);
  }

  const newLevel = calculateLevelFromXp(updatedUser.xp);
  if (newLevel !== updatedUser.level) {
    updatedUser.level = newLevel;
    await User.updateOne({ _id: user._id }, { $set: { level: newLevel } });
    referrals.maybePayReferralMilestone(user._id, newLevel).catch(() => {});
  }

  const io = realtime.getIo();
  if (io) {
    io.emit("caseOpened", {
      winningItems,
      user: {
        name: user.username,
        id: user._id,
        profilePicture: user.profilePicture,
        badge: badges.wornBadge(user),
      },
      caseImage: caseData.image,
      // the feed says where a drop came from, the way an upgrade already does
      ...(source ? { source } : {}),
    });
  }

  // the fan boards are a ten-minute snapshot, so a player who just pulled the
  // character they pinned would read the old count next to their new inventory
  await fandom.touch(user._id, winningItems.map((item) => item._id));

  const items = winningItems.map((item, index) => ({
    ...item,
    sellValue: sellValue(item.baseValue),
    rollId: rollIds[index],
  }));

  if (io) {
    io.to(user._id.toString()).emit("userDataUpdated", {
      walletBalance: updatedUser.walletBalance,
      xp: updatedUser.xp,
      level: updatedUser.level,
    });
  }

  return {
    ok: true,
    items,
    rollIds,
    caseData,
    cost,
    walletBalance: updatedUser.walletBalance,
    xp: updatedUser.xp,
    level: updatedUser.level,
  };
}

module.exports = { openCase, MAX_PER_OPEN };
