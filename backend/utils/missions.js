const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Battle = require("../models/Battle");
const User = require("../models/User");
const Case = require("../models/Case");
const MissionState = require("../models/MissionState");
const { creditUser, runAtomic, TX, STAKE_TYPES } = require("./economy");
const { CATALOG, byKey, missionsLaunchAt } = require("./missionsCatalog");

// a "big win" is any single game payout; pushes and refunds are returned stakes, not wins
const WIN_TYPES = [TX.SLOT_WIN, TX.PLINKO_WIN, TX.BLACKJACK_WIN, TX.DICE_WIN, TX.CRASH_CASHOUT, TX.COINFLIP_WIN];

// missions currently offered; a disabled one (active:false) stays defined but is
// never shown, announced, or claimable
const ACTIVE = CATALOG.filter((m) => m.active !== false);

// case collections the user has fully completed vs how many cases have items.
// populate + drop null (deleted) refs so "complete" matches exactly what the
// collections tab shows: a dangling item id is not a slot the album counts either.
async function collectionsProgress(userId) {
  const user = await User.findById(userId, { inventory: 1 });
  if (!user) return { done: 0, total: 0 };
  const owned = new Set((user.inventory || []).map((e) => String(e._id)));
  const cases = await Case.find({}, { items: 1 }).populate("items", "_id");
  let done = 0;
  let total = 0;
  for (const c of cases) {
    const items = [...new Set((c.items || []).filter(Boolean).map((it) => String(it._id)))];
    if (!items.length) continue;
    total += 1;
    if (items.every((id) => owned.has(id))) done += 1;
  }
  return { done, total };
}

async function countCompletedCollections(userId) {
  return (await collectionsProgress(userId)).done;
}

// ensure the per-user state doc exists, then return it
async function getState(userId) {
  await MissionState.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true });
  return MissionState.findOne({ userId });
}

// gather every signal the catalog needs in one pass. progress is derived, never
// stored, and only activity at/after the launch timestamp counts.
async function buildContext(userId, { includeCollections = true, state = null } = {}) {
  const launch = missionsLaunchAt();
  const [txAgg, battlesWon, collectionsCompleted, user, st] = await Promise.all([
    Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(String(userId)), createdAt: { $gte: launch } } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          qty: { $sum: { $ifNull: ["$meta.quantity", 0] } },
          maxAmount: { $max: "$amount" },
          sumAmount: { $sum: "$amount" },
          // rows without a side-bet marker: for blackjack this counts hands, not
          // the extra double/split/insurance charges on the same hand
          baseCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$meta.double", true] },
                    { $eq: ["$meta.split", true] },
                    { $eq: ["$meta.insurance", true] },
                  ],
                },
                0,
                1,
              ],
            },
          },
        },
      },
    ]),
    Battle.countDocuments({ winnerUserIds: userId, status: "finished", finishedAt: { $gte: launch } }),
    // the collections scan is the one heavy read; skip it on frequent hot-path calls
    includeCollections ? collectionsProgress(userId) : Promise.resolve({ done: 0, total: 0 }),
    User.findById(userId, { profilePicture: 1, friends: 1, level: 1, walletBalance: 1 }),
    // reuse an already-loaded state doc when the caller has one, to avoid re-reading it
    state || getState(userId),
  ]);

  const byType = {};
  for (const r of txAgg) byType[r._id] = r;
  const count = (t) => (byType[t] ? byType[t].count : 0);
  const sum = (t) => (byType[t] ? byType[t].sumAmount || 0 : 0);
  const openRow = byType[TX.CASE_OPEN];
  const casesOpened = openRow ? openRow.qty || openRow.count : 0; // sum of quantities, count as fallback
  const bigWin = WIN_TYPES.reduce((m, t) => Math.max(m, byType[t] ? byType[t].maxAmount || 0 : 0), 0);
  const totalWagered = STAKE_TYPES.reduce((s, t) => s + sum(t), 0);

  return {
    casesOpened,
    games: {
      crash: count(TX.CRASH_BET),
      coinflip: count(TX.COINFLIP_BET),
      slots: count(TX.SLOT_BET),
      blackjack: byType[TX.BLACKJACK_BET] ? byType[TX.BLACKJACK_BET].baseCount || 0 : 0,
    },
    coinflipWins: count(TX.COINFLIP_WIN),
    crashCashouts: count(TX.CRASH_CASHOUT),
    bonusesClaimed: count(TX.BONUS),
    marketSales: count(TX.MARKET_SALE),
    bigWin,
    totalWagered,
    battlesWon,
    collectionsCompleted: collectionsCompleted.done,
    collectionsTotal: collectionsCompleted.total,
    level: user ? user.level || 0 : 0,
    walletBalance: user ? user.walletBalance || 0 : 0,
    hasProfilePicture: !!(user && user.profilePicture && String(user.profilePicture).trim() !== ""),
    friendsCount: user && user.friends ? user.friends.length : 0,
    claimed: new Set((st && st.claimed) || []),
    visited: new Set((st && st.visited) || []),
    announced: new Set((st && st.announced) || []),
  };
}

function currentFor(mission, ctx) {
  switch (mission.metric) {
    case "casesOpened": return ctx.casesOpened;
    case "gamesPlayed:crash": return ctx.games.crash;
    case "gamesPlayed:coinflip": return ctx.games.coinflip;
    case "gamesPlayed:slots": return ctx.games.slots;
    case "gamesPlayed:blackjack": return ctx.games.blackjack;
    case "coinflipWins": return ctx.coinflipWins;
    case "bonusesClaimed": return ctx.bonusesClaimed;
    case "marketSales": return ctx.marketSales;
    case "bigWin": return ctx.bigWin;
    case "battlesWon": return ctx.battlesWon;
    case "collectionsCompleted": return ctx.collectionsCompleted;
    case "allCollectionsComplete":
      return ctx.collectionsTotal > 0 && ctx.collectionsCompleted >= ctx.collectionsTotal ? 1 : 0;
    case "crashCashouts": return ctx.crashCashouts;
    case "totalWagered": return ctx.totalWagered;
    case "level": return ctx.level;
    case "walletBalance": return ctx.walletBalance;
    case "profilePictureSet": return ctx.hasProfilePicture ? 1 : 0;
    case "friendsAdded": return ctx.friendsCount;
    case "social": return ctx.visited.has(mission.key) ? 1 : 0;
    default: return 0;
  }
}

function view(mission, ctx) {
  const raw = currentFor(mission, ctx);
  const complete = raw >= mission.target;
  const claimed = ctx.claimed.has(mission.key);
  return {
    key: mission.key,
    title: mission.title,
    description: mission.description,
    category: mission.category,
    reward: mission.reward,
    social: mission.social || null,
    target: mission.target,
    current: Math.min(raw, mission.target),
    complete,
    claimed,
    claimable: complete && !claimed,
  };
}

async function getMissionsView(userId) {
  const ctx = await buildContext(userId);
  const missions = ACTIVE.map((m) => view(m, ctx));
  const totals = {
    total: missions.length,
    completed: missions.filter((m) => m.complete).length,
    claimable: missions.filter((m) => m.claimable).length,
    claimed: missions.filter((m) => m.claimed).length,
  };
  return { missions, totals };
}

// missions that just became claimable and have not been announced yet, for the
// real-time "mission complete" toast. exactly-once: each key is announced via an
// atomic per-key guard, so concurrent /pending calls never double-toast. the first
// call ever for a user SEEDS silently (records current completions without returning
// them), so completions from before real-time tracking do not stack a burst.
async function getPendingAnnouncements(userId, { light = false } = {}) {
  const state = await getState(userId);
  if (!state.seeded) {
    // seed is always full so nothing pre-existing (incl. collections) ever toasts
    const fullCtx = await buildContext(userId, { includeCollections: true, state });
    const keys = ACTIVE.filter((m) => {
      const v = view(m, fullCtx);
      return v.complete && !v.claimed;
    }).map((m) => m.key);
    const update = { $set: { seeded: true } };
    if (keys.length) update.$addToSet = { announced: { $each: keys } };
    await MissionState.updateOne({ userId }, update);
    return [];
  }

  const ctx = await buildContext(userId, { includeCollections: !light, state });
  const pending = [];
  for (const m of ACTIVE) {
    const v = view(m, ctx);
    if (!v.complete || v.claimed || ctx.announced.has(m.key)) continue;
    const res = await MissionState.updateOne(
      { userId, announced: { $ne: m.key } },
      { $addToSet: { announced: m.key } }
    );
    if (res.modifiedCount === 1) pending.push({ key: m.key, title: m.title, reward: m.reward });
  }
  return pending;
}

// mark a social mission's link as clicked. honor-system: the server cannot verify
// the join/follow, which is why these rewards are tiny.
async function markVisited(userId, key) {
  const mission = byKey(key);
  if (!mission || mission.metric !== "social") return { ok: false };
  await MissionState.updateOne(
    { userId },
    { $setOnInsert: { userId }, $addToSet: { visited: key } },
    { upsert: true }
  );
  return { ok: true };
}

// claim a completed mission's reward exactly once. the mark is the mutex and it commits in
// one transaction with the credit, so a failed payout rolls it back instead of burning it.
async function claimMission(userId, key, io) {
  const mission = byKey(key);
  if (!mission || mission.active === false) return { code: 404, body: { message: "Mission not found" } };

  const ctx = await buildContext(userId);
  const v = view(mission, ctx);
  if (!v.complete) return { code: 400, body: { message: "Mission not complete" } };
  if (v.claimed) return { code: 200, body: { claimed: false, alreadyClaimed: true } };

  await MissionState.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true });

  let updated;
  try {
    updated = await runAtomic(async (session) => {
      const res = await MissionState.updateOne(
        { userId, claimed: { $ne: key } },
        { $addToSet: { claimed: key } },
        { session }
      );
      if (res.modifiedCount !== 1) return null; // a concurrent request claimed it first
      const credited = await creditUser(userId, mission.reward, 0, {
        type: TX.MISSION_REWARD,
        meta: { missionKey: key, missionTitle: mission.title },
        session,
      });
      if (!credited) throw new Error("mission credit failed"); // abort so the mark rolls back
      return credited;
    });
  } catch (e) {
    console.error("claimMission failed:", e);
    return { code: 500, body: { message: "Could not claim the reward, please try again" } };
  }

  if (updated === null) {
    return { code: 200, body: { claimed: false, alreadyClaimed: true } };
  }

  if (io) {
    io.to(userId.toString()).emit("userDataUpdated", {
      walletBalance: updated.walletBalance,
      xp: updated.xp,
      level: updated.level,
    });
  }

  return {
    code: 200,
    body: {
      claimed: true,
      reward: mission.reward,
      walletBalance: updated.walletBalance,
      missionKey: key,
    },
  };
}

module.exports = {
  getMissionsView,
  getPendingAnnouncements,
  markVisited,
  claimMission,
  buildContext,
  countCompletedCollections,
};
