const User = require("../models/User");
const Item = require("../models/Item");
const PokerTable = require("../models/PokerTable");
const { sellValue } = require("../utils/itemValue");
const { creditUser, recordTransaction, TX } = require("../utils/economy");
const { generateClientSeed } = require("../utils/provablyFair");
const { redeem, redeemable, atRiskAll } = require("../utils/pokerPool");

// seat, buy-in and cash-out. the hand itself lives in games/poker.js; everything here is
// about getting chips and items onto a table and back off it again.
//
// escrow is by removal: a staked item is pulled out of the user's inventory and into the
// table's pool. that is also the whole of the item lock-out, because inventory sell, the
// marketplace, upgrade, fixedItem and the avatar picker all read `user.inventory` and a
// staked item is simply not in it.

const MAX_STAKED_ITEMS = 8;

const seatOf = (table, userId) =>
  table.seats.findIndex((s) => s.userId && s.userId.toString() === userId.toString());

const chipsBySeat = (table) =>
  Object.fromEntries(table.seats.map((s) => [s.seat, s.userId ? s.stack : 0]));

// a fresh, empty chair
const emptySeat = (seat) => ({
  seat,
  userId: null,
  username: "",
  profilePicture: "",
  stack: 0,
  committed: 0,
  totalCommitted: 0,
  holeCards: [],
  status: "empty",
  clientSeed: null,
  hasActed: false,
  canRaise: true,
  autoFolds: 0,
  timeBankMs: 10000,
  leaveAfterHand: false,
  joinedAt: null,
});

function blankSeats(count) {
  return Array.from({ length: count }, (_, i) => emptySeat(i));
}

// the live catalog is the only price anyone is allowed to quote: an inventory entry is a
// snapshot taken at drop time and its value can be stale
async function valueItems(entries) {
  const ids = [...new Set(entries.map((e) => String(e._id)))];
  const items = await Item.find({ _id: { $in: ids } }, { baseValue: 1, name: 1, image: 1, rarity: 1 }).lean();
  const byId = new Map(items.map((i) => [String(i._id), i]));
  return entries.map((entry) => {
    const catalog = byId.get(String(entry._id)) || {};
    return {
      uniqueId: entry.uniqueId,
      itemId: entry._id,
      name: catalog.name || entry.name,
      image: catalog.image || entry.image,
      rarity: catalog.rarity || entry.rarity,
      value: sellValue(catalog.baseValue || 0),
    };
  });
}

// take a seat and put chips on it. kp and items are removed from the user in one atomic
// write, so a crash can never leave a player paying for a seat they did not get.
async function buyIn(tableId, userId, { seat, kp = 0, uniqueIds = [] } = {}) {
  const table = await PokerTable.findById(tableId);
  if (!table || !table.active) return { error: "Table not found" };

  const chips = Math.floor(Number(kp) || 0);
  if (chips < 0) return { error: "Invalid amount" };
  const ids = [...new Set((uniqueIds || []).map(String))];
  if (ids.length > MAX_STAKED_ITEMS) return { error: `At most ${MAX_STAKED_ITEMS} items` };
  if (seatOf(table, userId) >= 0) return { error: "You are already at this table" };

  const index = Math.floor(Number(seat));
  if (!Number.isInteger(index) || index < 0 || index >= table.seatCount) {
    return { error: "No such seat" };
  }

  const user = await User.findById(userId).select("username profilePicture inventory walletBalance").lean();
  if (!user) return { error: "User not found" };

  const staking = user.inventory.filter((e) => e && ids.includes(String(e.uniqueId)));
  if (staking.length !== ids.length) return { error: "You do not own all of those items" };

  const valued = await valueItems(staking);
  const itemValue = valued.reduce((sum, v) => sum + v.value, 0);
  const total = chips + itemValue;

  if (total < table.minBuyIn) return { error: `Minimum buy-in is K₽${table.minBuyIn}` };
  if (total > table.maxBuyIn) return { error: `Maximum buy-in is K₽${table.maxBuyIn}` };

  // claim the chair before touching money. the filter rejects a second claim on the same
  // seat and a second seat for the same player, closing both join races at once.
  const claimed = await PokerTable.findOneAndUpdate(
    {
      _id: tableId,
      active: true,
      [`seats.${index}.status`]: "empty",
      seats: { $not: { $elemMatch: { userId } } },
    },
    {
      $set: {
        [`seats.${index}.userId`]: userId,
        [`seats.${index}.username`]: user.username,
        [`seats.${index}.profilePicture`]: user.profilePicture,
        [`seats.${index}.status`]: "sitting",
        [`seats.${index}.stack`]: 0,
        [`seats.${index}.clientSeed`]: generateClientSeed(),
        [`seats.${index}.joinedAt`]: new Date(),
        [`seats.${index}.leaveAfterHand`]: false,
        [`seats.${index}.autoFolds`]: 0,
      },
      $inc: { actionSeq: 1 },
    },
    { new: true }
  );
  if (!claimed) return { error: "That seat was just taken" };

  // one atomic write: the balance guard, the debit and the item removal cannot separate
  const before = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: chips } },
    {
      $inc: { walletBalance: -chips },
      ...(ids.length ? { $pull: { inventory: { uniqueId: { $in: ids } } } } : {}),
    }
  );

  const removed = before ? before.inventory.filter((e) => e && ids.includes(String(e.uniqueId))) : [];
  if (!before || removed.length !== ids.length) {
    // put back whatever the write did take, then give up the chair
    if (before && removed.length) {
      await User.updateOne(
        { _id: userId },
        { $inc: { walletBalance: chips }, $push: { inventory: { $each: removed } } }
      );
    }
    await releaseSeat(tableId, index);
    return { error: before ? "You do not own all of those items" : "Not enough KP" };
  }

  await recordTransaction({
    userId,
    type: TX.POKER_BUYIN,
    direction: "debit",
    amount: chips,
    balanceAfter: before.walletBalance - chips,
    meta: { tableId: String(tableId), seat: index, items: ids.length, itemValue },
  });

  const pooled = valued.map((v) => ({ ...v, stakedBy: index, userId, stakedAt: new Date() }));
  const seated = await PokerTable.findOneAndUpdate(
    { _id: tableId, [`seats.${index}.userId`]: userId },
    {
      $set: { [`seats.${index}.stack`]: total, [`seats.${index}.status`]: "sitting" },
      ...(pooled.length ? { $push: { pool: { $each: pooled } } } : {}),
      $inc: { actionSeq: 1 },
    },
    { new: true }
  );

  return { ok: true, table: seated, seat: index, stack: total, staked: pooled };
}

async function releaseSeat(tableId, seat) {
  await PokerTable.updateOne(
    { _id: tableId },
    { $set: { [`seats.${seat}`]: emptySeat(seat) }, $inc: { actionSeq: 1 } }
  );
}

// leave the table: chips buy items out of the cage and whatever is left is paid in kp.
// a hand in progress defers this rather than letting somebody dodge a losing showdown.
async function cashOut(tableId, userId, picks) {
  const table = await PokerTable.findById(tableId);
  if (!table) return { error: "Table not found" };

  const index = seatOf(table, userId);
  if (index < 0) return { error: "You are not at this table" };

  const seat = table.seats[index];
  const inHand = ["active", "folded", "allin"].includes(seat.status) && table.status !== "idle";
  if (inHand) {
    await PokerTable.updateOne(
      { _id: tableId, [`seats.${index}.userId`]: userId },
      { $set: { [`seats.${index}.leaveAfterHand`]: true }, $inc: { actionSeq: 1 } }
    );
    return { ok: true, queued: true };
  }

  const pool = table.pool.map((e) => (e.toObject ? e.toObject() : e));
  const chosen = redeem(pool, index, seat.stack, picks);

  // only items nobody can hold on to are open to a leaver; their own are always theirs
  const openIds = new Set(atRiskAll(pool, chipsBySeat(table)).map((e) => String(e.uniqueId)));
  const illegal = chosen.items.find(
    (e) => e.stakedBy !== index && !openIds.has(String(e.uniqueId))
  );
  if (illegal) return { error: `${illegal.name} is not on the table` };

  const takenIds = chosen.items.map((e) => String(e.uniqueId));
  const entries = chosen.items.map((e) => ({
    uniqueId: e.uniqueId,
    _id: e.itemId,
    name: e.name,
    image: e.image,
    rarity: e.rarity,
    createdAt: new Date(),
  }));

  const emptied = await PokerTable.findOneAndUpdate(
    { _id: tableId, [`seats.${index}.userId`]: userId },
    {
      $set: { [`seats.${index}`]: emptySeat(index) },
      ...(takenIds.length ? { $pull: { pool: { uniqueId: { $in: takenIds } } } } : {}),
      $inc: { actionSeq: 1 },
    },
    { new: true }
  );
  if (!emptied) return { error: "You are not at this table" };

  if (entries.length) {
    await User.updateOne({ _id: userId }, { $push: { inventory: { $each: entries } } });
  }
  if (chosen.kp > 0) {
    await creditUser(userId, chosen.kp, 0, {
      type: TX.POKER_CASHOUT,
      meta: { tableId: String(tableId), seat: index, items: takenIds.length },
    });
  }

  return { ok: true, items: chosen.items, kp: chosen.kp, table: emptied };
}

// what the cash-out screen offers: their own affordable stake, then anything on the line
function cashOutOptions(table, userId) {
  const index = seatOf(table, userId);
  if (index < 0) return null;
  const pool = table.pool.map((e) => (e.toObject ? e.toObject() : e));
  return { seat: index, stack: table.seats[index].stack, ...redeemable(pool, index, table.seats[index].stack, chipsBySeat(table)) };
}

// what a player can put on the table, priced the way the table will price it. one row per
// copy, because escrow takes a specific uniqueId, not a kind of item.
async function stakeableFor(userId, limit = 200) {
  const user = await User.findById(userId).select("inventory walletBalance").lean();
  if (!user) return { items: [], walletBalance: 0 };

  const entries = (user.inventory || []).slice(-limit).reverse();
  const valued = await valueItems(entries);
  return {
    walletBalance: user.walletBalance,
    items: valued
      .filter((v) => v.value > 0)
      .sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name))),
  };
}

module.exports = {
  stakeableFor,
  MAX_STAKED_ITEMS,
  emptySeat,
  blankSeats,
  seatOf,
  chipsBySeat,
  valueItems,
  buyIn,
  cashOut,
  cashOutOptions,
  releaseSeat,
};
