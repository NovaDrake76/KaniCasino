const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { creditUser, runAtomic, TX, STAKE_TYPES } = require("./economy");

// both sides of a referral get this once, at the referee's registration
const REFERRAL_SIGNUP_BONUS = 100;
// the referrer's ongoing cut of everything their referees wager, paid by the house
const COMMISSION_RATE = 0.01;
// a referee counts as active if they wagered within this window
const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const CODE_PATTERN = /^[A-Z0-9]{3,16}$/;
const normalizeCode = (raw) => String(raw || "").trim().toUpperCase();

// set the user's vanity code once; it never changes so shared links never rot
async function setReferralCode(userId, raw) {
  const code = normalizeCode(raw);
  if (!CODE_PATTERN.test(code)) {
    return { code: 400, body: { message: "Codes are 3-16 letters or numbers" } };
  }
  try {
    const res = await User.updateOne(
      { _id: userId, referralCode: { $exists: false } },
      { $set: { referralCode: code } }
    );
    if (res.modifiedCount !== 1) {
      return { code: 400, body: { message: "Your code is already set" } };
    }
    return { code: 200, body: { referralCode: code } };
  } catch (err) {
    if (err && err.code === 11000) {
      return { code: 409, body: { message: "That code is taken" } };
    }
    throw err;
  }
}

const findReferrer = (raw) => {
  const code = normalizeCode(raw);
  if (!CODE_PATTERN.test(code)) return null;
  return User.findOne({ referralCode: code }, { _id: 1, username: 1 });
};

// the one-time signup bonuses. issuance (minted), so a failed leg is just a lost gift,
// never a corrupt ledger; registration must not fail over it
async function payReferralBonuses(referee, referrer) {
  await creditUser(referee._id, REFERRAL_SIGNUP_BONUS, 0, {
    type: TX.REFERRAL_BONUS,
    meta: { role: "referee", referrerId: String(referrer._id), referrerUsername: referrer.username },
  });
  await creditUser(referrer._id, REFERRAL_SIGNUP_BONUS, 0, {
    type: TX.REFERRAL_BONUS,
    meta: { role: "referrer", referredUserId: String(referee._id), referredUsername: referee.username },
  });
}

// per-referee wagered totals from the ledger; commission is derived, never accumulated,
// so a missed hook can never exist and the numbers always agree with history
async function refereeStats(userId) {
  const referees = await User.find(
    { referredBy: userId },
    { username: 1, profilePicture: 1 }
  ).lean();
  if (!referees.length) return [];

  const ids = referees.map((r) => r._id);
  const agg = await Transaction.aggregate([
    { $match: { userId: { $in: ids }, type: { $in: STAKE_TYPES } } },
    { $group: { _id: "$userId", wagered: { $sum: "$amount" }, lastAt: { $max: "$createdAt" } } },
  ]);
  const byId = new Map(agg.map((row) => [String(row._id), row]));

  const now = Date.now();
  return referees.map((r) => {
    const row = byId.get(String(r._id));
    const wagered = row ? row.wagered : 0;
    return {
      id: String(r._id),
      username: r.username,
      profilePicture: r.profilePicture || "",
      joinedAt: r._id.getTimestamp(),
      wagered,
      commission: Math.floor(wagered * COMMISSION_RATE),
      active: !!row && now - new Date(row.lastAt).getTime() < ACTIVE_WINDOW_MS,
    };
  });
}

// total commission ever earned: the sum of per-referee floors, so the table adds up
const earnedFrom = (referrals) => referrals.reduce((s, r) => s + r.commission, 0);

async function getDashboard(userId) {
  const [me, referrals] = await Promise.all([
    User.findById(userId, { referralCode: 1, referralClaimed: 1 }),
    refereeStats(userId),
  ]);
  if (!me) return null;

  const earned = earnedFrom(referrals);
  const claimed = me.referralClaimed || 0;
  return {
    referralCode: me.referralCode || null,
    signupBonus: REFERRAL_SIGNUP_BONUS,
    commissionRate: COMMISSION_RATE,
    totals: {
      earned,
      claimed,
      available: Math.max(0, earned - claimed),
      totalWagered: referrals.reduce((s, r) => s + r.wagered, 0),
      referralCount: referrals.length,
      activeCount: referrals.filter((r) => r.active).length,
    },
    referrals: referrals.sort((a, b) => b.wagered - a.wagered),
  };
}

// pay out everything earned but not yet claimed. the claimed-counter update is the
// mutex and commits in one transaction with the credit, like a mission claim.
async function claimCommission(userId) {
  const me = await User.findById(userId, { referralClaimed: 1 });
  if (!me) return { code: 404, body: { message: "User not found" } };

  const earned = earnedFrom(await refereeStats(userId));
  const claimed = me.referralClaimed || 0;
  const available = earned - claimed;
  if (available < 1) return { code: 400, body: { message: "Nothing to claim yet" } };

  // older docs have no referralClaimed field at all, and null matches missing
  const claimedFilter = claimed === 0 ? { $in: [0, null] } : claimed;
  let updated;
  try {
    updated = await runAtomic(async (session) => {
      const res = await User.updateOne(
        { _id: userId, referralClaimed: claimedFilter },
        { $inc: { referralClaimed: available } },
        { session }
      );
      if (res.modifiedCount !== 1) return null; // a concurrent claim got here first
      const credited = await creditUser(userId, available, 0, {
        type: TX.REFERRAL_COMMISSION,
        meta: { earned, claimedBefore: claimed },
        session,
      });
      if (!credited) throw new Error("commission credit failed"); // abort, roll the counter back
      return credited;
    });
  } catch (e) {
    console.error("claimCommission failed:", e);
    return { code: 500, body: { message: "Could not claim, please try again" } };
  }

  if (updated === null) {
    return { code: 409, body: { message: "Already claiming, try again" } };
  }
  return { code: 200, body: { claimed: available, user: updated } };
}

module.exports = {
  REFERRAL_SIGNUP_BONUS,
  COMMISSION_RATE,
  normalizeCode,
  setReferralCode,
  findReferrer,
  payReferralBonuses,
  getDashboard,
  claimCommission,
};
