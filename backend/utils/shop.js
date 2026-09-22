const User = require("../models/User");
const Transaction = require("../models/Transaction");
const ChatMessage = require("../models/ChatMessage");
const Marketplace = require("../models/Marketplace");
const PredictionTrade = require("../models/PredictionTrade");
const beta = require("./beta");
const { ITEMS, itemOf, boostsOf, REVEAL_AHEAD } = require("./shopCatalog");
const { runAtomic, recordTransaction, WITHOUT_INVENTORY, TX } = require("./economy");
const { getIo } = require("./realtime");

// what proves an account used a feature before the shop existed. each is one exists query, run once
// per account and then stored; the chat's capped room has no userId index but holds at most 6 MB
const EVIDENCE = {
  collectionBook: async (user) =>
    (user.badges || []).some((b) => String(b.key).startsWith("collection:")) ||
    !!(await Transaction.exists({ userId: user._id, type: TX.ITEM_SELL, "meta.source": "quicksell" })),
  tradersLicense: async (user) =>
    !!(await Transaction.exists({ userId: user._id, type: { $in: [TX.MARKET_BUY, TX.MARKET_SALE, TX.MARKET_ORDER] } })) ||
    !!(await Marketplace.exists({ sellerId: user._id })),
  chatPass: async (user) => !!(await ChatMessage.exists({ userId: user._id })),
  // a code already set is an affiliate already at work; the charm and the seal are new perks, so nobody held them before
  affiliateCard: async (user) => !!user.referralCode,
  // the live bets strip left no trace of who looked at it, so nobody is kept
  spyglass: async () => false,
  giftCharm: async () => false,
  merchantSeal: async () => false,
  goldenTicket: async () => false,
  rainCoat: async () => false,
  predictionPass: async (user) => !!(await PredictionTrade.exists({ userId: user._id })),
};
// a boost or a charm is new, so nobody held one before the shop
const evidenceOf = (item) => EVIDENCE[item.key] || (async () => false);

const keysOf = (entries) => (entries || []).map((u) => u.key);

// what an account holds. the first time an account in the beta is asked about, its history is read for
// the features it already used and those are kept; after that only a purchase adds to it
async function heldBy(user) {
  if (user.unlocksCheckedAt) return user.unlocks || [];
  const held = keysOf(user.unlocks);
  const hits = await Promise.all(ITEMS.map((item) => (held.includes(item.key) ? false : evidenceOf(item)(user))));
  const at = new Date();
  const kept = ITEMS.filter((item, i) => hits[i]).map((item) => ({ key: item.key, via: "history", at }));
  const res = await User.updateOne(
    { _id: user._id, unlocksCheckedAt: null },
    { $set: { unlocksCheckedAt: at }, $push: { unlocks: { $each: kept } } }
  );
  if (!res.modifiedCount) {
    // a request at the same moment read the history first, and its answer is the one kept
    const fresh = await User.findById(user._id, { unlocks: 1 }).lean();
    return (fresh && fresh.unlocks) || [];
  }
  const entries = [...(user.unlocks || []), ...kept];
  user.unlocks = entries;
  user.unlocksCheckedAt = at;
  return entries;
}

const unlocksOf = async (user) => keysOf(await heldBy(user));

// null when the account may use the feature: outside the beta nothing is locked, inside it the
// feature needs its item
async function lockFor(user, key) {
  if (!user || !beta.has(user, "daisu")) return null;
  if ((await unlocksOf(user)).includes(key)) return null;
  return { message: "That needs an item from Daisu's shop", reason: "locked", unlock: key };
}

// what the shelf shows: everything held, and the next few items in order whatever their kind. the rest are only counted, so buying is how the player finds out what comes next
const revealedFor = (held) => {
  const keys = keysOf(held);
  let ahead = 0;
  return ITEMS.filter((item) => keys.includes(item.key) || ++ahead <= REVEAL_AHEAD);
};

async function viewFor(user) {
  const held = await heldBy(user);
  const shown = revealedFor(held);
  const hidden = ITEMS.length - shown.length;
  return {
    items: shown.map((item) => {
      const mine = held.find((u) => u.key === item.key);
      return { ...item, owned: !!mine, via: mine ? mine.via : null };
    }),
    hidden,
    xpBoost: boostsOf(keysOf(held)),
    walletBalance: user.walletBalance,
    level: user.level || 0,
  };
}

// a perk checked on a hot path, like a sale's fee: no history is read, because a perk is only ever bought
const holds = (user, key) => !!user && beta.has(user, "daisu") && keysOf(user.unlocks).includes(key);

async function buy(user, key) {
  const item = itemOf(key);
  if (!item) return { code: 404, body: { message: "That is not in the shop" } };
  const held = await heldBy(user);
  // an item still off the shelf cannot be bought by guessing its name
  if (!revealedFor(held).some((shown) => shown.key === key)) return { code: 404, body: { message: "That is not in the shop" } };
  if (held.some((u) => u.key === key)) {
    return { code: 200, body: { bought: false, alreadyOwned: true, key, unlocks: keysOf(held), shop: await viewFor(user) } };
  }
  if ((user.level || 0) < item.level) return { code: 400, body: { message: `That needs level ${item.level}`, reason: "level" } };

  const at = new Date();
  let updated;
  try {
    // one write takes the KP and grants the unlock, guarded on the balance, the level and not already
    // owning it, so two purchases landing together charge once
    updated = await runAtomic(async (session) => {
      // the xp multipliers are rewritten from what is held plus this, in the same write
      const u = await User.findOneAndUpdate(
        { _id: user._id, walletBalance: { $gte: item.price }, level: { $gte: item.level }, "unlocks.key": { $ne: key } },
        { $inc: { walletBalance: -item.price }, $push: { unlocks: { key, via: "bought", at } }, $set: { xpBoost: boostsOf([...keysOf(held), key]) } },
        { new: true, projection: WITHOUT_INVENTORY, session }
      );
      if (!u) return null;
      await recordTransaction(
        { userId: user._id, type: TX.SHOP_PURCHASE, direction: "debit", amount: item.price, balanceAfter: u.walletBalance, meta: { unlock: key } },
        session
      );
      return u;
    });
  } catch (e) {
    console.error("shop purchase failed:", e);
    return { code: 500, body: { message: "Could not buy that, please try again" } };
  }

  if (!updated) {
    const fresh = await User.findById(user._id, WITHOUT_INVENTORY).lean();
    if (fresh && keysOf(fresh.unlocks).includes(key)) {
      return { code: 200, body: { bought: false, alreadyOwned: true, key, unlocks: keysOf(fresh.unlocks), shop: await viewFor(fresh) } };
    }
    return { code: 400, body: { message: "Not enough KP", reason: "funds" } };
  }

  const io = getIo();
  if (io) io.to(String(user._id)).emit("userDataUpdated", { walletBalance: updated.walletBalance, xp: updated.xp, level: updated.level });
  return {
    code: 200,
    body: { bought: true, key, walletBalance: updated.walletBalance, unlocks: keysOf(updated.unlocks), xpBoost: updated.xpBoost || {}, shop: await viewFor(updated) },
  };
}

module.exports = { unlocksOf, lockFor, holds, viewFor, buy };
