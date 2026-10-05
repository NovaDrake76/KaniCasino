const mongoose = require("mongoose");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const IpSighting = require("../models/IpSighting");
const { creditUser, runAtomic, TX, STAKE_TYPES } = require("./economy");
const { isRealMoneyMode } = require("./mode");
const ledgerDays = require("./ledgerDays");
const verification = require("./verification");

// what each side gets when the referee registers. the affiliate card's shop copy quotes the referrer's numbers, in every locale
const REFERRER_SIGNUP_BONUS = 1000;
const REFEREE_SIGNUP_BONUS = 500;
// paid to the referrer once, when the referee proves real: verified, at this level, and back on this many different days
const MILESTONE_LEVEL = 10;
const MILESTONE_DAYS = 7;
const MILESTONE_BONUS = 10000;
// the referrer's ongoing cut: a share of what the house expects to keep on their referees' bets, so no game pays a
// referee and their referrer together more than it costs them
const COMMISSION_SHARE = 0.25;
// what the house keeps per K₽ staked, on average. a prediction trades against a market rather than an edge, so none
const HOUSE_EDGE = {
  [TX.CRASH_BET]: 0.0397,
  [TX.COINFLIP_BET]: 0.03,
  [TX.SLOT_BET]: 0.0355,
  [TX.PLINKO_BET]: 0.035,
  [TX.BLACKJACK_BET]: 0.005,
  [TX.DICE_BET]: 0.01,
  [TX.MINES_BET]: 0.01,
  [TX.HILO_BET]: 0.01,
  [TX.CASE_OPEN]: 0.1,
  [TX.BATTLE_ENTRY]: 0.1,
  [TX.PREDICTION_BUY]: 0,
};
// the cut before the edge rule: one percent of every stake, which paid a blackjack referee and their referrer to play
const LEGACY_COMMISSION_RATE = 0.01;
const DAY_MS = 24 * 60 * 60 * 1000;
// a referee counts as active if they wagered within this window
const ACTIVE_WINDOW_MS = 7 * DAY_MS;
// wagers before this utc midnight earn commission from any referee, as they did when they were made; from it only a
// verified referee's count. a midnight, so a folded ledger day never straddles it.
const commissionVerifiedFrom = () => new Date(process.env.REFERRAL_VERIFIED_FROM || "2026-10-05T00:00:00Z");
// wagers from this utc midnight earn the edge share; earlier ones keep the one percent they were made under
const commissionEdgeFrom = () => new Date(process.env.REFERRAL_EDGE_FROM || "2026-10-06T00:00:00Z");

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

const oid = (id) => new mongoose.Types.ObjectId(String(id));

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

// the referees, out of `referees`, who were seen on a connection their referrer was also seen on: one person with two
// accounts, or two people under one roof, which only staff can tell apart. `extra` adds hashes a sighting has not stored yet
async function sharingConnection(referees, extra = {}) {
  const people = referees.flatMap((r) => [r._id, r.referredBy]).filter(Boolean);
  if (!people.length) return new Set();
  const rows = await IpSighting.find({ userId: { $in: people } }, { userId: 1, ipHash: 1, _id: 0 }).lean();
  const hashes = new Map();
  for (const row of rows) {
    const key = String(row.userId);
    if (!hashes.has(key)) hashes.set(key, new Set());
    hashes.get(key).add(row.ipHash);
  }
  const shared = new Set();
  for (const r of referees) {
    const theirs = hashes.get(String(r.referredBy));
    if (!theirs) continue;
    const mine = [...(hashes.get(String(r._id)) || []), ...(extra[String(r._id)] || [])];
    if (mine.some((h) => theirs.has(h))) shared.add(String(r._id));
  }
  return shared;
}

// clear pays, held waits for staff, rejected never pays. a staff approval clears a shared connection for good
const standingOf = (referee, shared) => {
  if (referee.referralReview === "rejected") return "rejected";
  if (referee.referralReview === "approved") return "clear";
  return shared.has(String(referee._id)) ? "held" : "clear";
};

// the distinct utc days an account placed any bet on
async function daysPlayed(userId) {
  const rows = await Transaction.aggregate([
    ...(await ledgerDays.stream({ userId: oid(userId), type: { $in: STAKE_TYPES } })),
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$day" } } } },
    { $count: "days" },
  ]);
  return rows.length ? rows[0].days : 0;
}

const SETTLE_FIELDS = {
  username: 1,
  referredBy: 1,
  level: 1,
  referralBonusPending: 1,
  referralMilestonePaid: 1,
  referralReview: 1,
  ...verification.VERIFIED_FIELDS,
};

// the referrer's signup bonus that waited for verification. clearing the pending flag is the mutex and commits with the
// credit, so it pays once and a failed credit stays owed
async function paySignupBonus(referee) {
  let paid = null;
  try {
    paid = await runAtomic(async (session) => {
      const row = await User.findOneAndUpdate(
        { _id: referee._id, referralBonusPending: true },
        { $unset: { referralBonusPending: "" } },
        { projection: { _id: 1 }, session }
      );
      if (!row) return null;
      const credited = await creditUser(referee.referredBy, REFERRER_SIGNUP_BONUS, 0, {
        type: TX.REFERRAL_BONUS,
        meta: { role: "referrer", referredUserId: String(referee._id), referredUsername: referee.username },
        session,
      });
      if (!credited) throw new Error("referrer bonus credit failed"); // abort, the flag stays set
      return credited;
    });
  } catch (e) {
    console.error("referral bonus failed:", e);
  }
  if (!paid) return false;
  await notify(
    referee.referredBy, referee._id, "Referral bonus",
    `${referee.username} verified their account: +K₽${REFERRER_SIGNUP_BONUS}. You earn K₽${MILESTONE_BONUS} more once they reach level ${MILESTONE_LEVEL} and have played on ${MILESTONE_DAYS} different days.`
  );
  return true;
}

// the milestone, once per referee. the paid flag is the mutex and commits in one transaction with the credit, so a
// failed payout rolls it back and the next settle retries it
async function payMilestone(referee) {
  try {
    const paid = await runAtomic(async (session) => {
      const res = await User.updateOne(
        { _id: referee._id, referralMilestonePaid: { $ne: true } },
        { $set: { referralMilestonePaid: true } },
        { session }
      );
      if (res.modifiedCount !== 1) return null; // a concurrent settle already paid it
      const credited = await creditUser(referee.referredBy, MILESTONE_BONUS, 0, {
        type: TX.REFERRAL_MILESTONE,
        meta: { referredUserId: String(referee._id), referredUsername: referee.username, level: MILESTONE_LEVEL },
        session,
      });
      if (!credited) throw new Error("milestone credit failed"); // abort, flag rolls back
      return credited;
    });
    if (paid === null) return false;
  } catch (e) {
    console.error("referral milestone failed:", e);
    return false;
  }

  const referrer = await User.findById(referee.referredBy, { username: 1 });
  await notify(
    referee.referredBy, referee._id, "Referral milestone",
    `${referee.username} reached level ${MILESTONE_LEVEL} and played on ${MILESTONE_DAYS} different days: +K₽${MILESTONE_BONUS}.`
  );
  await notify(
    referee._id, referee.referredBy, "Referral milestone",
    `You reached level ${MILESTONE_LEVEL} and played on ${MILESTONE_DAYS} different days, and ${referrer ? referrer.username : "your referrer"} earned K₽${MILESTONE_BONUS}.`
  );
  return true;
}

// pay what a referee has earned their referrer so far: the signup bonus once they are verified, the milestone once
// they also have the level and the days. nothing while staff review a shared connection, and nothing once rejected
async function settleReferee(userId, { extraHashes = [] } = {}) {
  const done = { bonus: false, milestone: false, held: false };
  if (!referralsEnabled()) return done;
  const referee = await User.findOne({ _id: userId, referredBy: { $ne: null } }, SETTLE_FIELDS).lean();
  if (!referee || !verification.isVerified(referee)) return done;
  const owesBonus = !!referee.referralBonusPending;
  const pastLevel = !referee.referralMilestonePaid && (referee.level || 0) >= MILESTONE_LEVEL;
  if (!owesBonus && !pastLevel) return done;

  const shared = await sharingConnection([referee], { [String(referee._id)]: extraHashes });
  const standing = standingOf(referee, shared);
  done.held = standing === "held";
  if (standing !== "clear") return done;
  if (owesBonus) done.bonus = await paySignupBonus(referee);
  if (pastLevel && (await daysPlayed(referee._id)) >= MILESTONE_DAYS) done.milestone = await payMilestone(referee);
  return done;
}

// the one-time signup bonuses. issuance (minted), so a failed leg is just a lost gift, never a corrupt ledger;
// registration must not fail over it. the referrer's part waits on the same rules as everything after it
async function payReferralBonuses(referee, referrer, { ipHash = null } = {}) {
  await creditUser(referee._id, REFEREE_SIGNUP_BONUS, 0, {
    type: TX.REFERRAL_BONUS,
    meta: { role: "referee", referrerId: String(referrer._id), referrerUsername: referrer.username },
  });
  await notify(
    referee._id, referrer._id, "Referral bonus",
    `Welcome! Signing up with ${referrer.username}'s code paid you K₽${REFEREE_SIGNUP_BONUS}.`
  );
  await User.updateOne({ _id: referee._id }, { $set: { referralBonusPending: true } });
  // a verified signup can settle now. its own sighting may not be written yet, so the address it came from is passed in
  const settled = await settleReferee(referee._id, { extraHashes: ipHash ? [ipHash] : [] });
  if (settled.bonus) return;
  await notify(
    referrer._id, referee._id, "Referral bonus",
    settled.held
      ? `${referee.username} joined with your code from a connection you have also used, so what they earn you waits for a staff review.`
      : `${referee.username} joined with your code. You get K₽${REFERRER_SIGNUP_BONUS} once their account is verified, and K₽${MILESTONE_BONUS} more once they reach level ${MILESTONE_LEVEL} and have played on ${MILESTONE_DAYS} different days.`
  );
}

// the referee was just verified: whatever was waiting on it
const settleOnVerified = (userId) => settleReferee(userId);

// the referees a bet already looked at today. a bet can only add today to their days played, so one look a day is
// enough; verifying, a staff decision and the sweep settle on their own
let lookedOn = null;
const lookedAt = new Set();

// a level-up, or any bet: the milestone may be due. a bet hands in the account it just charged, so a player nobody
// referred, one already paid for or one the rules do not count yet costs no read
async function maybePayReferralMilestone(userId, level, known = null) {
  if (!referralsEnabled() || level < MILESTONE_LEVEL) return;
  if (known) {
    if (!known.referredBy || known.referralMilestonePaid || known.referralReview === "rejected") return;
    if (!verification.isVerified(known)) return;
    const today = Math.floor(Date.now() / DAY_MS);
    if (lookedOn !== today) {
      lookedOn = today;
      lookedAt.clear();
    }
    if (lookedAt.has(String(userId))) return;
    lookedAt.add(String(userId));
  }
  await settleReferee(userId);
}

// the cron's pass over referees still owed something, whose days or a staff decision may have come since. it reads only
// those accounts (a few dozen at the site's size), their sightings and their ledger days
async function sweepReferrals() {
  if (!referralsEnabled()) return 0;
  const due = await User.find(
    {
      referredBy: { $exists: true, $ne: null },
      referralReview: { $ne: "rejected" },
      $and: [
        verification.verifiedFilter(),
        { $or: [{ referralBonusPending: true }, { referralMilestonePaid: { $ne: true }, level: { $gte: MILESTONE_LEVEL } }] },
      ],
    },
    { _id: 1 }
  ).lean();
  let paid = 0;
  for (const { _id } of due) {
    const done = await settleReferee(_id);
    if (done.bonus || done.milestone) paid += 1;
  }
  return paid;
}

// what each referee earns their referrer, from the ledger: one percent of stakes before the edge rule, the edge share
// after it. commission is derived, never accumulated, so it can be recomputed and only `referralClaimed` is stored
async function refereeStats(userId) {
  const referees = await User.find(
    { referredBy: userId },
    { username: 1, profilePicture: 1, level: 1, referredBy: 1, referralMilestonePaid: 1, referralReview: 1, ...verification.VERIFIED_FIELDS }
  ).lean();
  if (!referees.length) return [];

  const ids = referees.map((r) => r._id);
  const verifiedFrom = commissionVerifiedFrom();
  const edgeFrom = commissionEdgeFrom();
  const [[facets], shared] = await Promise.all([
    Transaction.aggregate([
      ...(await ledgerDays.stream({ userId: { $in: ids }, type: { $in: STAKE_TYPES } })),
      {
        $facet: {
          sums: [
            {
              $group: {
                _id: { u: "$userId", t: "$type", early: { $lt: ["$day", verifiedFrom] }, legacy: { $lt: ["$day", edgeFrom] } },
                amount: { $sum: "$amount" },
                last: { $max: "$last" },
              },
            },
          ],
          days: [
            { $group: { _id: { u: "$userId", d: { $dateToString: { format: "%Y-%m-%d", date: "$day" } } } } },
            { $group: { _id: "$_id.u", days: { $sum: 1 } } },
          ],
        },
      },
    ]),
    sharingConnection(referees),
  ]);

  const rowsOf = new Map();
  for (const row of facets.sums) {
    const key = String(row._id.u);
    if (!rowsOf.has(key)) rowsOf.set(key, []);
    rowsOf.get(key).push(row);
  }
  const daysOf = new Map(facets.days.map((d) => [String(d._id), d.days]));

  const now = Date.now();
  return referees.map((r) => {
    const rows = rowsOf.get(String(r._id)) || [];
    const verified = verification.isVerified(r);
    let wagered = 0;
    let legacy = 0;
    let edge = 0;
    let lastAt = 0;
    for (const row of rows) {
      wagered += row.amount;
      lastAt = Math.max(lastAt, new Date(row.last).getTime() || 0);
      // an unverified referee earns on what they wagered before the verified rule; everything counts once they verify
      if (!verified && !row._id.early) continue;
      if (row._id.legacy) legacy += row.amount;
      else edge += row.amount * (HOUSE_EDGE[row._id.t] || 0);
    }
    const standing = standingOf(r, shared);
    // what the old rules paid stays earned, as the verified rule did; a hold or a rejection only stops the edge share
    const counted = legacy * LEGACY_COMMISSION_RATE + (standing === "clear" ? edge * COMMISSION_SHARE : 0);
    return {
      id: String(r._id),
      username: r.username,
      profilePicture: r.profilePicture || "",
      joinedAt: r._id.getTimestamp(),
      level: r.level || 0,
      milestonePaid: !!r.referralMilestonePaid,
      daysPlayed: daysOf.get(String(r._id)) || 0,
      wagered,
      verified,
      review: standing === "clear" ? null : standing,
      commission: Math.floor(counted),
      active: rows.length > 0 && now - lastAt < ACTIVE_WINDOW_MS,
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
    milestoneDays: MILESTONE_DAYS,
    milestoneBonus: MILESTONE_BONUS,
    commissionShare: COMMISSION_SHARE,
    houseEdge: HOUSE_EDGE,
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

// staff's queue: referees who share a connection with their referrer and have no decision yet, with what waits on them.
// an admin page read, so it can afford to look at every referee
async function heldReferrals() {
  const referees = await User.find(
    { referredBy: { $ne: null }, referralReview: { $exists: false } },
    { username: 1, level: 1, referredBy: 1, referralBonusPending: 1, referralMilestonePaid: 1, ...verification.VERIFIED_FIELDS }
  ).lean();
  const shared = await sharingConnection(referees);
  const held = referees.filter((r) => shared.has(String(r._id)));
  if (!held.length) return [];

  const referrers = await User.find({ _id: { $in: held.map((r) => r.referredBy) } }, { username: 1 }).lean();
  const nameOf = new Map(referrers.map((u) => [String(u._id), u.username]));
  const wageredRows = await Transaction.aggregate([
    ...(await ledgerDays.stream({ userId: { $in: held.map((r) => r._id) }, type: { $in: STAKE_TYPES } })),
    { $group: { _id: "$userId", amount: { $sum: "$amount" } } },
  ]);
  const wageredOf = new Map(wageredRows.map((w) => [String(w._id), w.amount]));
  const days = await Promise.all(held.map((r) => daysPlayed(r._id)));

  return held.map((r, i) => ({
    id: String(r._id),
    username: r.username,
    level: r.level || 0,
    verified: verification.isVerified(r),
    daysPlayed: days[i],
    wagered: wageredOf.get(String(r._id)) || 0,
    bonusPending: !!r.referralBonusPending,
    milestonePaid: !!r.referralMilestonePaid,
    referrer: { id: String(r.referredBy), username: nameOf.get(String(r.referredBy)) || null },
  }));
}

// a staff decision on a referee. approving pays whatever was waiting on the review; rejecting means the referee never
// earns their referrer anything again. a decision can be changed later
async function reviewReferral(refereeId, decision, staffId) {
  if (decision !== "approved" && decision !== "rejected") return { code: 400, body: { message: "Approve or reject" } };
  if (!mongoose.Types.ObjectId.isValid(String(refereeId))) return { code: 404, body: { message: "No such referee" } };
  const res = await User.updateOne(
    { _id: refereeId, referredBy: { $ne: null } },
    { $set: { referralReview: decision, referralReviewedAt: new Date(), referralReviewedBy: staffId } }
  );
  if (!res.matchedCount) return { code: 404, body: { message: "No such referee" } };
  const { bonus, milestone } = decision === "approved" ? await settleReferee(refereeId) : { bonus: false, milestone: false };
  return { code: 200, body: { decision, paid: { bonus, milestone } } };
}

module.exports = {
  REFERRER_SIGNUP_BONUS,
  REFEREE_SIGNUP_BONUS,
  MILESTONE_LEVEL,
  MILESTONE_DAYS,
  MILESTONE_BONUS,
  COMMISSION_SHARE,
  HOUSE_EDGE,
  LEGACY_COMMISSION_RATE,
  referralsEnabled,
  normalizeCode,
  setReferralCode,
  findReferrer,
  payReferralBonuses,
  maybePayReferralMilestone,
  settleOnVerified,
  settleReferee,
  sweepReferrals,
  daysPlayed,
  getDashboard,
  claimCommission,
  heldReferrals,
  reviewReferral,
};
