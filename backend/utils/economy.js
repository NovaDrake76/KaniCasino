const User = require("../models/User");
const Transaction = require("../models/Transaction");

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
  COINFLIP_BET: "coinflip_bet",
  COINFLIP_WIN: "coinflip_win",
  BATTLE_ENTRY: "battle_entry",
  BATTLE_REFUND: "battle_refund",
  MARKET_BUY: "market_buy",
  MARKET_SALE: "market_sale",
  MARKET_ORDER: "market_order", // KP escrowed when a buy order is placed
  MARKET_ORDER_REFUND: "market_order_refund", // escrow returned on cancel
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
async function recordTransaction({ userId, type, direction, amount, balanceAfter, meta }) {
  if (!userId || !amount) return null;
  try {
    return await Transaction.create({
      userId,
      type: type || (direction === "debit" ? "charge" : "credit"),
      direction,
      amount: Math.abs(amount),
      balanceAfter,
      meta: meta || {},
    });
  } catch (err) {
    console.error("recordTransaction failed:", err);
    return null;
  }
}

// atomically debit `cost` only if the balance covers it, optionally granting xp.
// returns the updated user, or null when funds are insufficient.
async function chargeUser(userId, cost, { awardXp = true, type, meta } = {}) {
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
  });

  return user;
}

// atomically credit winnings to the wallet (and weekly winnings).
// returns the updated user, or null when the account no longer exists.
async function creditUser(userId, amount, winnings = 0, { type, meta } = {}) {
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
  TX,
};
