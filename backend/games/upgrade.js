const User = require("../models/User");
const Item = require("../models/Item");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const fandom = require("../utils/fandom");
const { entriesFor } = require("../utils/inventoryCounts");
const { rollFloat, TOTAL } = require("../utils/provablyFair");

const UPGRADE_ALGO_VERSION = 3; // bump if calculateSuccessRate ever changes

// return by target rarity: the edge grows with rarity, so upgrading into a rare item is a
// worse deal per attempt than upgrading into a common one.
// legendary sits at 0.3 because at 0.6 upgrading was the cheap route to one: a player who
// fed a thousand opens back in ended with about 14 legendaries against the 2.6 the cases
// gave them, so 82% of them were made here rather than dropped. halving it makes a
// legendary cost 7,697 KP of items instead of 3,848, against 23,100 to open for one.
const UPGRADE_RTP_BY_RARITY = { "1": 0.9, "2": 0.9, "3": 0.85, "4": 0.75, "5": 0.3 };

// how far above its own rarity an item may be staked. with no limit a pile of commons was a
// legitimate run at a legendary, and forty blues bought the 12% ceiling outright: cheap to
// assemble, so the rarest items stopped being a milestone and became a grind. two tiers
// means a legendary can only be fed rares and epics, which have to be earned first.
const UPGRADE_MAX_RARITY_GAP = 2;

// max success chance by target rarity: piling in cheap items cannot make a rare upgrade a
// sure thing, so stacking a heap of low items into an ultra is still a gamble. no case odds.
const UPGRADE_CEILING = { "1": 0.9, "2": 0.7, "3": 0.45, "4": 0.25, "5": 0.12 };

// the stake measured against the prize, p = RTP * staked / target, capped by the target's
// rarity ceiling; below the ceiling the edge is 1 - RTP(rarity), so mixing colors never moves it.
const calculateSuccessRate = (stakedValue, targetValue, targetRarity) => {
  if (!(stakedValue > 0) || !(targetValue > 0)) return 0;
  const rtp = UPGRADE_RTP_BY_RARITY[String(targetRarity)] || 0.9;
  const ceiling = UPGRADE_CEILING[String(targetRarity)] || 0.9;
  return Math.min((rtp * stakedValue) / targetValue, ceiling);
};

// Helper function to validate if all items belong to the same case
const allItemsFromSameCase = (items) => {
  const caseId = items[0].case;
  if (!caseId) return false;
  return items.every((item) => item.case && item.case.toString() === caseId.toString());
};

// "lesser" and "gap" are separate because they are different mistakes and the player is
// told which one they made
const verifyRarityGap = (selectedItems, targetItem) => {
  const target = Number(targetItem.rarity);
  for (const item of selectedItems) {
    const source = Number(item.rarity);
    if (source > target) return { ok: false, reason: "lesser" };
    if (target - source > UPGRADE_MAX_RARITY_GAP) return { ok: false, reason: "gap" };
  }
  return { ok: true };
}

const upgradeItems = async (userId, selectedItemIds, targetItemId) => {
  try {
    if (!(await User.exists({ _id: userId }))) {
      return { status: 404, message: "User not found" };
    }

    // only the copies being staked, picked in mongo
    const selectedItems = await entriesFor(userId, { uniqueIds: selectedItemIds || [] });
    const targetItem = await Item.findById(targetItemId);

    // Validation checks
    if (!targetItem) {
      return { status: 400, message: "No target item selected" };
    }

    if (selectedItems.length === 0) {
      return { status: 400, message: "No items selected" };
    }

    // the catalog is the authority on what an item is worth: an inventory entry carries
    // no value at all, and some older ones lost their case too
    const catalog = await Item.find(
      { _id: { $in: [...new Set(selectedItems.map((invItem) => String(invItem._id)))] } },
      { baseValue: 1, case: 1 }
    );
    const sourceById = new Map(catalog.map((item) => [String(item._id), item]));

    // backfill case for items that lost it (e.g. bought before case was preserved)
    for (const item of selectedItems) {
      if (!item.case) {
        const sourceItem = sourceById.get(String(item._id));
        if (sourceItem) item.case = sourceItem.case;
      }
    }

    if (!allItemsFromSameCase([...selectedItems, targetItem])) {
      return { status: 400, message: "All items must be from the same case" };
    }

    const gap = verifyRarityGap(selectedItems, targetItem);
    if (!gap.ok) {
      return {
        status: 400,
        message:
          gap.reason === "lesser"
            ? "You can't upgrade to a lesser rarity"
            : `You can only upgrade up to ${UPGRADE_MAX_RARITY_GAP} rarities above what you put in`,
      };
    }

    const stakedValue = selectedItems.reduce((sum, invItem) => {
      const sourceItem = sourceById.get(String(invItem._id));
      return sum + ((sourceItem && sourceItem.baseValue) || 0);
    }, 0);
    const targetValue = targetItem.baseValue || 0;
    if (!(stakedValue > 0) || !(targetValue > 0)) {
      return { status: 400, message: "These items have no value yet" };
    }

    // reserve the provably-fair nonce up front (atomic, never rolled back)
    const reserved = await seeds.reserveNonces(userId, 1);
    const nonce = reserved.startNonce;

    // consume the selected items in one atomic step. the filter demands every one of
    // them is still there, so a request that loses the race to a sale or another
    // upgrade removes nothing at all. it used to $pull first and count afterwards,
    // which meant losing that race destroyed whichever items it did still find.
    const consumeIds = selectedItems.map((invItem) => invItem.uniqueId);
    // the filter is what makes this all-or-nothing; the document itself goes unread
    const before = await User.findOneAndUpdate(
      { _id: userId, "inventory.uniqueId": { $all: consumeIds } },
      { $pull: { inventory: { uniqueId: { $in: consumeIds } } } },
      { projection: { _id: 1 } }
    );
    if (!before) {
      return { status: 400, message: "Items no longer available" };
    }

    // success is the provably-fair roll: succeed when the [0,1) draw is below the rate
    const successRate = calculateSuccessRate(stakedValue, targetValue, targetItem.rarity);
    const rollFloatValue = rollFloat(reserved.serverSeed, reserved.clientSeed, nonce);
    const isSuccess = rollFloatValue < successRate;

    let producedUniqueId = null;
    if (isSuccess) {
      // Add the target item to the user's inventory
      producedUniqueId = require('uuid').v4();
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            inventory: {
              _id: targetItem._id,
              name: targetItem.name,
              image: targetItem.image,
              rarity: targetItem.rarity,
              case: targetItem.case,
              createdAt: new Date(),
              uniqueId: producedUniqueId,
            },
          },
        }
      );
    }

    // both ends of an upgrade can be a pinned character: the copies it ate and the
    // one it produced
    await fandom.touch(userId, [...selectedItems.map((invItem) => invItem._id), targetItem._id]);

    const rec = await rolls.recordRoll({
      game: "upgrade",
      userId,
      seedId: reserved.seedId,
      clientSeed: reserved.clientSeed,
      serverSeedHash: reserved.serverSeedHash,
      nonce,
      roll: Math.floor(rollFloatValue * TOTAL) + 1,
      total: TOTAL,
      uniqueId: producedUniqueId,
      outcome: {
        success: isSuccess,
        successRate,
        // the two numbers the rate is derived from, so a past roll stays checkable
        // even after the catalog revalues the items
        stakedValue,
        targetValue,
        targetItemId: String(targetItem._id),
        targetRarity: targetItem.rarity,
        algoVersion: UPGRADE_ALGO_VERSION,
      },
    });

    return {
      status: 200,
      success: isSuccess,
      item: isSuccess ? targetItem : null,
      rollId: rec.rollId,
    };
  } catch (error) {
    console.error(error);
    return { status: 500, message: "Internal server error" };
  }
};

module.exports = upgradeItems;
// exposed for unit testing
module.exports.calculateSuccessRate = calculateSuccessRate;
module.exports.UPGRADE_RTP_BY_RARITY = UPGRADE_RTP_BY_RARITY;
module.exports.UPGRADE_CEILING = UPGRADE_CEILING;
module.exports.UPGRADE_MAX_RARITY_GAP = UPGRADE_MAX_RARITY_GAP;
module.exports.verifyRarityGap = verifyRarityGap;
