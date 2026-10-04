const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const { creditUser, runAtomic, TX, STAKE_TYPES } = require("./economy");
const { isRealMoneyMode } = require("./mode");
const ledgerDays = require("./ledgerDays");
const verification = require("./verification");

// what each side gets when the referee registers. the affiliate card's shop copy quotes the referrer's numbers, in every locale
const REFERRER_SIGNUP_BONUS = 1000;
const REFEREE_SIGNUP_BONUS = 500;
// paid to the referrer once, when the referee proves real by reaching this level
const MILESTONE_LEVEL = 10;
const MILESTONE_BONUS = 10000;
// the referrer's ongoing cut of everything their referees wager, paid by the house
const COMMISSION_RATE = 0.01;
// a referee counts as active if they wagered within this window
const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
// wagers before this utc midnight earn commission from any referee, as they did when they were made; from it only a
// verified referee's count. a midnight, so a folded ledger day never straddles it.
const commissionVerifiedFrom = () => new Date(process.env.REFERRAL_VERIFIED_FROM || "2026-10-05T00:00:00Z");

// referrals mint marketing KP, which only makes sense while balances are play money
const referralsEnabled = () => !isRealMoneyMode();

const CODE_PATTERN = /^[A-Z0-9]{3,16}$/;
const normalizeCode = (raw) => String(raw || "").trim().toUpperCase();

// in-app notification; the bell picks it up on the next fetch, no socket needed here
const nameFilter = require("./nameFilter");

const notify = (receiverId, senderId, title, content) =>
  Notification.create({ receiverId, senderId, type: "message", title, content }).catch((err) =>
    console.error("referral notify failed:", err)
  );

// set the user's vanity code once; it never changes so shared links never rot
async function setReferralCode(userId, raw) {
  if (!referralsEnabled()) {
    return { code: 403, body: { message: "Referrals are disabled" } };
  }
  const code = normalizeCode(raw);
  if (!CODE_PATTERN.test(code)) {
    return { code: 400, body: { message: "Codes are 3-16 letters or numbers" } };
  }
  if (nameFilter.findSlur(code)) {
    return { code: 400, body: { message: "Please choose a different code" } };
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
  if (!referralsEnabled()) return null;
  const code = normalizeCode(raw);
  if (!CODE_PATTERN.test(code)) return null;
  return User.findOne({ referralCode: code }, { _id: 1, username: 1 });
};

// the one-time signup bonuses. issuance (minted), so a failed leg is just a lost gift,
// never a corrupt ledger; registration must not fail over it
async function payReferralBonuses(referee, referrer) {
  await creditUser(referee._id, REFEREE_SIGNUP_BONUS, 0, {
    type: TX.REFERRAL_BONUS,
    meta: { role: "referee", referrerId: String(referrer._id), referrerUsername: referrer.username },
  });
  await notify(
    referee._id, referrer._id, "Referral bonus",
    `Welcome! Signing up with ${referrer.username}'s code paid you K₽${REFEREE_SIGNUP_BONUS}.`
  );
  // the referrer is paid for an account somebody can vouch for, so an unverified one waits (settleOnVerified)
  if (verification.isVerified(referee)) {
    await creditUser(referrer._id, REFERRER_SIGNUP_BONUS, 0, {
      type: TX.REFERRAL_BONUS,
      meta: { role: "referrer", referredUserId: String(referee._id), referredUsername: referee.username },
    });
    await notify(
      referrer._id, referee._id, "Referral bonus",
      `${referee.username} joined with your code: +K₽${REFERRER_SIGNUP_BONUS}. If they reach level ${MILESTONE_LEVEL} you earn K₽${MILESTONE_BONUS} more.`
    );
    return;
  }
  await User.updateOne({ _id: referee._id }, { $set: { referralBonusPending: true } });
  await notify(
    referrer._id, referee._id, "Referral bonus",
    `${referee.username} joined with your code. You get K₽${REFERRER_SIGNUP_BONUS} when they verify their account, and K₽${MILESTONE_BONUS} more if they reach level ${MILESTONE_LEVEL}.`
  );
}

// the referee was just verified: the signup bonus that waited, then the milestone if they are already past it.
// clearing the pending flag is the mutex and commits with the credit, so it pays once and a failed credit stays owed.
async function settleOnVerified(userId) {
  if (!referralsEnabled()) return;
  let waiting = null;
  try {
    waiting = await runAtomic(async (session) => {
      const row = await User.findOneAndUpdate(
        { _id: userId, referralBonusPending: true, referredBy: { $ne: null } },
        { $unset: { referralBonusPending: "" } },
        { projection: { username: 1, referredBy: 1 }, session }
      );
      if (!row) return null;
      const credited = await creditUser(row.referredBy, REFERRER_SIGNUP_BONUS, 0, {
        type: TX.REFERRAL_BONUS,
        meta: { role: "referrer", referredUserId: String(row._id), referredUsername: row.username },
        session,
      });
      if (!credited) throw new Error("referrer bonus credit failed"); // abort, the flag stays set
      return row;
    });
  } catch (e) {
    console.error("referral bonus failed:", e);
  }
  if (waiting) {
    await notify(
      waiting.referredBy, userId, "Referral bonus",
      `${waiting.username} verified their account: +K₽${REFERRER_SIGNUP_BONUS}. If they reach level ${MILESTONE_LEVEL} you earn K₽${MILESTONE_BONUS} more.`
    );
  }
  const me = await User.findById(userId, { level: 1, referredBy: 1 });
  if (me && me.referredBy) await maybePayReferralMilestone(userId, me.level || 0);
}

// pay the level milestone once per referee. the paid flag is the mutex and commits in
// one transaction with the credit, so a failed payout rolls it back and retries later.
async function maybePayReferralMilestone(userId, level, known = null) {
  if (!referralsEnabled() || level < MILESTONE_LEVEL) return;
  // a bet hands in the account it just charged, so a player nobody referred, or one already paid for, costs no read
  if (known && (!known.referredBy || known.referralMilestonePaid)) return;
  // an unverified referee pays nothing yet; verifying settles it (settleOnVerified)
  const referee = await User.findOne(
    { _id: userId, referredBy: { $ne: null }, referralMilestonePaid: { $ne: true }, ...verification.verifiedFilter() },
    { username: 1, referredBy: 1 }
  );
  if (!referee) return;

  try {
    const paid = await runAtomic(async (session) => {
      const res = await User.updateOne(
        { _id: userId, referralMilestonePaid: { $ne: true } },
        { $set: { referralMilestonePaid: true } },
        { session }
      );
      if (res.modifiedCount !== 1) return null; // a concurrent level-up already paid it
      const credited = await creditUser(referee.referredBy, MILESTONE_BONUS, 0, {
        type: TX.REFERRAL_MILESTONE,
        meta: { referredUserId: String(userId), referredUsername: referee.username, level: MILESTONE_LEVEL },
        session,
      });
      if (!credited) throw new Error("milestone credit failed"); // abort, flag rolls back
      return credited;
    });
    if (paid === null) return;
  } catch (e) {
    console.error("referral milestone failed:", e);
    return;
  }

  const referrer = await User.findById(referee.referredBy, { username: 1 });
  await notify(
    referee.referredBy, userId, "Referral milestone",
    `${referee.username} reached level ${MILESTONE_LEVEL}: +K₽${MILESTONE_BONUS}.`
  );
  await notify(
    userId, referee.referredBy, "Referral milestone",
    `You reached level ${MILESTONE_LEVEL} and ${referrer ? referrer.username : "your referrer"} earned K₽${MILESTONE_BONUS}.`
  );
}

// per-referee wagered totals from the ledger; commission is derived, never accumulated,
// so a missed hook can never exist and the numbers always agree with history
async function refereeStats(userId) {
  const referees = await User.find(
    { referredBy: userId },
    { username: 1, profilePicture: 1, level: 1, referralMilestonePaid: 1, ...verification.VERIFIED_FIELDS }
  ).lean();
  if (!referees.length) return [];

  const ids = referees.map((r) => r._id);
  const from = commissionVerifiedFrom();
  const agg = await Transaction.aggregate([
    ...(await ledgerDays.stream({ userId: { $in: ids }, type: { $in: STAKE_TYPES } })),
    {
      $group: {
        _id: "$userId",
        wagered: { $sum: "$amount" },
        earlier: { $sum: { $cond: [{ $lt: ["$day", from] }, "$amount", 0] } },
        lastAt: { $max: "$last" },
      },
    },
  ]);
  const byId = new Map(agg.map((row) => [String(row._id), row]));

  const now = Date.now();
  return referees.map((r) => {
    const row = byId.get(String(r._id));
    const wagered = row ? row.wagered : 0;
    // an unverified referee earns on what they wagered before the rule; everything counts once they verify
    const verified = verification.isVerified(r);
    const counted = verified ? wagered : row ? row.earlier : 0;
    return {
      id: String(r._id),
      username: r.username,
      profilePicture: r.profilePicture || "",
      joinedAt: r._id.getTimestamp(),
      level: r.level || 0,
      milestonePaid: !!r.referralMilestonePaid,
      wagered,
      verified,
      commission: Math.floor(counted * COMMISSION_RATE),
      active: !!row && now - new Date(row.lastAt).getTime() < ACTIVE_WINDOW_MS,
    };
  });
}

// total commission ever earned: the sum of per-referee floors, so the table adds up
const earnedFrom = (referrals) => referrals.reduce((s, r) => s + r.commission, 0);

async function getDashboard(userId) {
  if (!referralsEnabled()) return { enabled: false };
  const [me, referrals] = await Promise.all([
    User.findById(userId, { referralCode: 1, referralClaimed: 1 }),
    refereeStats(userId),
  ]);
  if (!me) return null;

  const earned = earnedFrom(referrals);
  const claimed = me.referralClaimed || 0;
  return {
    enabled: true,
    referralCode: me.referralCode || null,
    referrerBonus: REFERRER_SIGNUP_BONUS,
    refereeBonus: REFEREE_SIGNUP_BONUS,
    milestoneLevel: MILESTONE_LEVEL,
    milestoneBonus: MILESTONE_BONUS,
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
  if (!referralsEnabled()) return { code: 403, body: { message: "Referrals are disabled" } };
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
  REFERRER_SIGNUP_BONUS,
  REFEREE_SIGNUP_BONUS,
  MILESTONE_LEVEL,
  MILESTONE_BONUS,
  COMMISSION_RATE,
  referralsEnabled,
  normalizeCode,
  setReferralCode,
  findReferrer,
  payReferralBonuses,
  maybePayReferralMilestone,
  settleOnVerified,
  getDashboard,
  claimCommission,
};
