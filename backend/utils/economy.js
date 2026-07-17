const mongoose = require("mongoose");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { COUNTERPARTY_FOR_TYPE, MINT } = require("./accounts");

const BASE_XP = 1000; // xp required for the first level
const GROWTH_RATE = 1.25; // growth rate for each level

// canonical transaction types, so every ledger write uses the same labels
const TX = {
  SIGNUP: "signup",
  BONUS: "bonus",
  CASE_OPEN: "case_open",
  SLOT_BET: "slot_bet",
  SLOT_WIN: "slot_win",
  CRASH_BET: "crash_bet",
  CRASH_CASHOUT: "crash_cashout",
  CRASH_REFUND: "crash_refund", // stake returned when a restart voids a live round
  COINFLIP_BET: "coinflip_bet",
  COINFLIP_WIN: "coinflip_win",
  COINFLIP_REFUND: "coinflip_refund", // stake returned when a restart voids a live round
  BATTLE_ENTRY: "battle_entry",
  BATTLE_REFUND: "battle_refund",
  MARKET_BUY: "market_buy",
  MARKET_SALE: "market_sale",
  MARKET_FEE: "market_fee", // the house cut on a settled trade, credited to HOUSE
  MARKET_ORDER: "market_order", // KP escrowed when a buy order is placed
  MARKET_ORDER_REFUND: "market_order_refund", // escrow returned on cancel
  MARKET_ORDER_FILL: "market_order_fill", // escrow paid out to a seller on a fill
  ITEM_SELL: "item_sell",
  ADMIN_ADJUST: "admin_adjust",
  MISSION_REWARD: "mission_reward",
};

function calculateXPForLevel(level) {
  return Math.floor(BASE_XP * Math.pow(GROWTH_RATE, level - 1));
}

// level is fully derived from xp, so this is idempotent and safe to recompute
function calculateLevelFromXp(xp) {
  let level = 0;
  while (xp >= calculateXPForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

// append a balance-history entry. best-effort audit: a failed write here must
// never break the money path, so it logs and swallows rather than throwing.
async function recordTransaction({ userId, type, direction, amount, balanceAfter, meta, counterparty }) {
  if (!userId || !amount) return null;
  // counterparty is the account on the other side; most types have a fixed one, and
  // caller-supplied wins so market trades can name the actual player or system leg
  const other = counterparty !== undefined ? counterparty : COUNTERPARTY_FOR_TYPE[type];
  try {
    return await Transaction.create({
      userId,
      type: type || (direction === "debit" ? "charge" : "credit"),
      direction,
      amount: Math.abs(amount),
      balanceAfter,
      counterparty: other,
      meta: meta || {},
    });
  } catch (err) {
    console.error("recordTransaction failed:", err);
    return null;
  }
}

// any account's balance derived from the ledger: each row is a transfer between userId
// and counterparty, so the two sides read its signed amount oppositely
async function accountBalance(accountId) {
  const id = new mongoose.Types.ObjectId(String(accountId));
  const [row] = await Transaction.aggregate([
    { $match: { $or: [{ userId: id }, { counterparty: id }] } },
    {
      $group: {
        _id: null,
        bal: {
          $sum: {
            $cond: [
              { $eq: ["$userId", id] },
              { $cond: [{ $eq: ["$direction", "credit"] }, "$amount", { $multiply: ["$amount", -1] }] },
              { $cond: [{ $eq: ["$direction", "credit"] }, { $multiply: ["$amount", -1] }, "$amount"] },
            ],
          },
        },
      },
    },
  ]);
  return row ? row.bal : 0;
}

// total KP in circulation is everything the mint has issued and not taken back
async function ledgerSupply() {
  return -(await accountBalance(MINT));
}

// atomically debit `cost` only if the balance covers it, optionally granting xp.
// returns the updated user, or null when funds are insufficient.
async function chargeUser(userId, cost, { awardXp = true, type, meta, counterparty } = {}) {
  const inc = awardXp
    ? { walletBalance: -cost, xp: cost * 5 }
    : { walletBalance: -cost };

  const user = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: cost } },
    { $inc: inc },
    { new: true }
  );

  if (!user) {
    return null;
  }

  if (awardXp) {
    const newLevel = calculateLevelFromXp(user.xp);
    if (newLevel !== user.level) {
      user.level = newLevel;
      await User.updateOne({ _id: userId }, { $set: { level: newLevel } });
    }
  }

  await recordTransaction({
    userId,
    type,
    direction: "debit",
    amount: cost,
    balanceAfter: user.walletBalance,
    meta,
    counterparty,
  });

  return user;
}

// atomically credit winnings to the wallet (and weekly winnings).
// returns the updated user, or null when the account no longer exists.
async function creditUser(userId, amount, winnings = 0, { type, meta, counterparty } = {}) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: amount, weeklyWinnings: winnings } },
    { new: true }
  );

  if (!user) {
    return null;
  }

  await recordTransaction({
    userId,
    type,
    direction: "credit",
    amount,
    balanceAfter: user.walletBalance,
    meta,
    counterparty,
  });

  return user;
}

// grant xp without touching the wallet, then recompute the derived level.
// kept separate from chargeUser so xp can be awarded only after an action
// commits (a wallet refund then has no xp to reverse).
async function awardXp(userId, xpAmount) {
  if (!xpAmount) return null;
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { xp: xpAmount } },
    { new: true }
  );
  if (!user) return null;

  const newLevel = calculateLevelFromXp(user.xp);
  if (newLevel !== user.level) {
    user.level = newLevel;
    await User.updateOne({ _id: userId }, { $set: { level: newLevel } });
  }
  return user;
}

module.exports = {
  calculateXPForLevel,
  calculateLevelFromXp,
  recordTransaction,
  chargeUser,
  creditUser,
  awardXp,
  accountBalance,
  ledgerSupply,
  TX,
};
