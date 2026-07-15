const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Battle = require("../models/Battle");
const User = require("../models/User");
const Case = require("../models/Case");
const MissionState = require("../models/MissionState");
const { creditUser, TX } = require("./economy");
const { CATALOG, byKey, missionsLaunchAt } = require("./missionsCatalog");

// a "big win" is any single game payout (slots / crash cashout / coin flip win)
const WIN_TYPES = [TX.SLOT_WIN, TX.CRASH_CASHOUT, TX.COINFLIP_WIN];

// how many case collections the user has fully completed (every catalog item owned).
// populate + drop null (deleted) refs so "complete" matches exactly what the
// collections tab shows: a dangling item id is not a slot the album counts either.
async function countCompletedCollections(userId) {
  const user = await User.findById(userId, { inventory: 1 });
  if (!user) return 0;
  const owned = new Set((user.inventory || []).map((e) => String(e._id)));
  const cases = await Case.find({}, { items: 1 }).populate("items", "_id");
  let done = 0;
  for (const c of cases) {
    const items = [...new Set((c.items || []).filter(Boolean).map((it) => String(it._id)))];
    if (items.length && items.every((id) => owned.has(id))) done += 1;
  }
  return done;
}

// ensure the per-user state doc exists, then return it
async function getState(userId) {
  await MissionState.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true });
  return MissionState.findOne({ userId });
}

// gather every signal the catalog needs in one pass. progress is derived, never
// stored, and only activity at/after the launch timestamp counts.
async function buildContext(userId) {
  const launch = missionsLaunchAt();
  const [txAgg, battlesWon, collectionsCompleted, user, state] = await Promise.all([
    Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(String(userId)), createdAt: { $gte: launch } } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          qty: { $sum: { $ifNull: ["$meta.quantity", 0] } },
          maxAmount: { $max: "$amount" },
        },
      },
    ]),
    Battle.countDocuments({ winnerUserIds: userId, status: "finished", finishedAt: { $gte: launch } }),
    countCompletedCollections(userId),
    User.findById(userId, { profilePicture: 1, friends: 1 }),
    getState(userId),
  ]);

  const byType = {};
  for (const r of txAgg) byType[r._id] = r;
  const count = (t) => (byType[t] ? byType[t].count : 0);
  const openRow = byType[TX.CASE_OPEN];
  const casesOpened = openRow ? openRow.qty || openRow.count : 0; // sum of quantities, count as fallback
  const bigWin = WIN_TYPES.reduce((m, t) => Math.max(m, byType[t] ? byType[t].maxAmount || 0 : 0), 0);

  return {
    casesOpened,
    games: { crash: count(TX.CRASH_BET), coinflip: count(TX.COINFLIP_BET), slots: count(TX.SLOT_BET) },
    coinflipWins: count(TX.COINFLIP_WIN),
    bonusesClaimed: count(TX.BONUS),
    marketSales: count(TX.MARKET_SALE),
    bigWin,
    battlesWon,
    collectionsCompleted,
    hasProfilePicture: !!(user && user.profilePicture && String(user.profilePicture).trim() !== ""),
    friendsCount: user && user.friends ? user.friends.length : 0,
    claimed: new Set((state && state.claimed) || []),
    visited: new Set((state && state.visited) || []),
  };
}

function currentFor(mission, ctx) {
  switch (mission.metric) {
    case "casesOpened": return ctx.casesOpened;
    case "gamesPlayed:crash": return ctx.games.crash;
    case "gamesPlayed:coinflip": return ctx.games.coinflip;
    case "gamesPlayed:slots": return ctx.games.slots;
    case "coinflipWins": return ctx.coinflipWins;
    case "bonusesClaimed": return ctx.bonusesClaimed;
    case "marketSales": return ctx.marketSales;
    case "bigWin": return ctx.bigWin;
    case "battlesWon": return ctx.battlesWon;
    case "collectionsCompleted": return ctx.collectionsCompleted;
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
  const missions = CATALOG.map((m) => view(m, ctx));
  const totals = {
    total: missions.length,
    completed: missions.filter((m) => m.complete).length,
    claimable: missions.filter((m) => m.claimable).length,
    claimed: missions.filter((m) => m.claimed).length,
  };
  return { missions, totals };
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

// claim a completed mission's reward exactly once. the one-time guard lives in the
// update FILTER (claimed !contains key), so two concurrent claims can never both
// credit: the second finds the key already present and modifies nothing. the wallet
// is credited only after the claim is marked, so a failure never double-pays.
async function claimMission(userId, key, io) {
  const mission = byKey(key);
  if (!mission) return { code: 404, body: { message: "Mission not found" } };

  const ctx = await buildContext(userId);
  const v = view(mission, ctx);
  if (!v.complete) return { code: 400, body: { message: "Mission not complete" } };
  if (v.claimed) return { code: 200, body: { claimed: false, alreadyClaimed: true } };

  await MissionState.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true });
  const res = await MissionState.updateOne(
    { userId, claimed: { $ne: key } },
    { $addToSet: { claimed: key } }
  );
  if (res.modifiedCount !== 1) {
    return { code: 200, body: { claimed: false, alreadyClaimed: true } };
  }

  const updated = await creditUser(userId, mission.reward, 0, {
    type: TX.MISSION_REWARD,
    meta: { missionKey: key, missionTitle: mission.title },
  });

  if (io && updated) {
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
      walletBalance: updated ? updated.walletBalance : undefined,
      missionKey: key,
    },
  };
}

module.exports = { getMissionsView, markVisited, claimMission, buildContext, countCompletedCollections };
