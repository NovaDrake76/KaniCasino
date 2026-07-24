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
  PLINKO_BET: "plinko_bet",
  PLINKO_WIN: "plinko_win",
  CRASH_BET: "crash_bet",
  CRASH_CASHOUT: "crash_cashout",
  CRASH_REFUND: "crash_refund", // stake returned when a restart voids a live round
  COINFLIP_BET: "coinflip_bet",
  COINFLIP_WIN: "coinflip_win",
  COINFLIP_REFUND: "coinflip_refund", // stake returned when a restart voids a live round
  BATTLE_ENTRY: "battle_entry",
  BATTLE_REFUND: "battle_refund",
  BLACKJACK_BET: "blackjack_bet",
  BLACKJACK_WIN: "blackjack_win",
  BLACKJACK_PUSH: "blackjack_push", // stake returned on a tie, not a win
  BLACKJACK_REFUND: "blackjack_refund", // stake returned when a deal is voided
  DICE_BET: "dice_bet",
  DICE_WIN: "dice_win",
  MINES_BET: "mines_bet",
  MINES_WIN: "mines_win",
  MARKET_BUY: "market_buy",
  MARKET_SALE: "market_sale",
  MARKET_FEE: "market_fee", // the house cut on a settled trade, credited to HOUSE
  MARKET_ORDER: "market_order", // KP escrowed when a buy order is placed
  MARKET_ORDER_REFUND: "market_order_refund", // escrow returned on cancel
  MARKET_ORDER_FILL: "market_order_fill", // escrow paid out to a seller on a fill
  ITEM_SELL: "item_sell",
  ADMIN_ADJUST: "admin_adjust",
  MISSION_REWARD: "mission_reward",
  REFERRAL_BONUS: "referral_bonus", // one-time signup bonus, both sides of a referral
  REFERRAL_COMMISSION: "referral_commission", // the referrer's cut of referred wagers
  REFERRAL_MILESTONE: "referral_milestone", // one-time payout when a referee reaches level 10
  AD_REWARD: "ad_reward", // KP paid for a completed rewarded ad view
  OPENING: "opening_balance", // the pre-ledger balance, booked once against genesis
};

// every KP put at risk on a game; missions and referral commission both count these
const STAKE_TYPES = [TX.CRASH_BET, TX.COINFLIP_BET, TX.SLOT_BET, TX.PLINKO_BET, TX.BLACKJACK_BET, TX.DICE_BET, TX.MINES_BET, TX.BATTLE_ENTRY, TX.CASE_OPEN];

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

// whether the connected mongo supports multi-document transactions, probed at boot.
// production is Atlas (a replica set) and always does; a standalone dev mongod does not.
let txSupported = false;
function setTransactionsSupported(v) { txSupported = Boolean(v); }
function transactionsSupported() { return txSupported; }

// true on a replica set or a mongos, the topologies where transactions work
async function probeTransactions() {
  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    return Boolean(info.setName || info.msg === "isdbgrid");
  } catch (err) {
    return false;
  }
}

// run a money operation atomically when transactions are available, else best-effort
// without a session. prod always has them, so prod gets the guarantee.
async function runAtomic(fn) {
  if (!txSupported) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// append a balance-history entry. inside a transaction a failed row must abort the
// money move, so it throws; without one it stays best-effort and swallows.
async function recordTransaction({ userId, type, direction, amount, balanceAfter, meta, counterparty }, session = null) {
  if (!userId || !amount) return null;
  const other = counterparty !== undefined ? counterparty : COUNTERPARTY_FOR_TYPE[type];
  const doc = {
    userId,
    type: type || (direction === "debit" ? "charge" : "credit"),
    direction,
    amount: Math.abs(amount),
    balanceAfter,
    counterparty: other,
    meta: meta || {},
  };
  if (session) {
    const [row] = await Transaction.create([doc], { session });
    return row;
  }
  try {
    return await Transaction.create(doc);
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

// debit `cost` if the balance covers it, with its ledger row in the same transaction:
// a failed row rolls the charge back and returns null, like insufficient funds
async function chargeUser(userId, cost, { awardXp = true, type, meta, counterparty, session } = {}) {
  const inc = awardXp
    ? { walletBalance: -cost, xp: cost * 5 }
    : { walletBalance: -cost };

  const body = async (s) => {
    const user = await User.findOneAndUpdate(
      { _id: userId, walletBalance: { $gte: cost } },
      { $inc: inc },
      { new: true, session: s }
    );
    if (!user) return null;

    if (awardXp) {
      const newLevel = calculateLevelFromXp(user.xp);
      if (newLevel !== user.level) {
        user.level = newLevel;
        await User.updateOne({ _id: userId }, { $set: { level: newLevel } }, { session: s });
      }
    }

    await recordTransaction(
      { userId, type, direction: "debit", amount: cost, balanceAfter: user.walletBalance, meta, counterparty },
      s
    );
    return user;
  };

  // joining a caller's transaction: let a failure propagate so their whole op aborts
  if (session) return body(session);
  try {
    const user = await runAtomic(body);
    // the level may have crossed the referral milestone; lazy require breaks the cycle
    if (user && awardXp) {
      require("./referrals").maybePayReferralMilestone(userId, user.level).catch(() => {});
    }
    return user;
  } catch (err) {
    console.error("chargeUser rolled back:", err);
    return null;
  }
}

// atomically credit winnings to the wallet (and weekly winnings). the credit and its
// ledger row commit together; a failed row rolls the credit back and returns null.
async function creditUser(userId, amount, winnings = 0, { type, meta, counterparty, session } = {}) {
  const body = async (s) => {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { walletBalance: amount, weeklyWinnings: winnings } },
      { new: true, session: s }
    );
    if (!user) return null;

    await recordTransaction(
      { userId, type, direction: "credit", amount, balanceAfter: user.walletBalance, meta, counterparty },
      s
    );
    return user;
  };

  // joining a caller's transaction: let a failure propagate so their whole op aborts
  if (session) return body(session);
  try {
    return await runAtomic(body);
  } catch (err) {
    console.error("creditUser rolled back:", err);
    return null;
  }
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
    require("./referrals").maybePayReferralMilestone(userId, newLevel).catch(() => {});
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
  runAtomic,
  probeTransactions,
  setTransactionsSupported,
  transactionsSupported,
  TX,
  STAKE_TYPES,
};
