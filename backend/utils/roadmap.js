const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Battle = require("../models/Battle");
const MissionState = require("../models/MissionState");
const User = require("../models/User");
const PredictionTrade = require("../models/PredictionTrade");
const { creditUser, runAtomic, TX, STAKE_TYPES } = require("./economy");
const { CHAPTERS, chapterOf } = require("./roadmapCatalog");
const { liveStreak } = require("./dailyGift");
const { getIo } = require("./realtime");
const { casesCompletedBy } = require("./collectionCheck");

const GAME_BETS = [TX.SLOT_BET, TX.PLINKO_BET, TX.CRASH_BET, TX.COINFLIP_BET, TX.BLACKJACK_BET, TX.DICE_BET, TX.MINES_BET, TX.HILO_BET];
const TRADES = [TX.MARKET_BUY, TX.MARKET_SALE, TX.MARKET_ORDER_FILL];
const GAME_WINS = [TX.SLOT_WIN, TX.PLINKO_WIN, TX.CRASH_CASHOUT, TX.COINFLIP_WIN, TX.BLACKJACK_WIN, TX.DICE_WIN, TX.MINES_WIN, TX.HILO_WIN];
// the goals read from the ledger, and the row types each one needs
const LEDGER_TYPES = {
  fullPots: [TX.BONUS],
  bonusSpent: STAKE_TYPES,
  itemsSold: [TX.ITEM_SELL],
  gamesTried: GAME_BETS,
  marketTrades: TRADES,
  casesOpened: [TX.CASE_OPEN],
  staked: STAKE_TYPES,
  daysPlayed: STAKE_TYPES,
  bigWin: GAME_WINS,
  rainsCaught: [TX.RAIN_PAYOUT],
};
// only a page knows it was looked at, so these are the goals a page may report
const VISIT_GOALS = ["collectionVisits"];

const normalize = (roadmap = {}) => ({
  chapter: roadmap.chapter || 1,
  openedAt: roadmap.openedAt || null,
  claimed: roadmap.claimed || [],
  visited: roadmap.visited || [],
  seeded: roadmap.seeded || 0,
});

// the account's roadmap, opening chapter one the first time anything asks for it
async function stateOf(userId) {
  const doc = await MissionState.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, new: true, lean: true });
  const roadmap = normalize(doc.roadmap);
  if (!roadmap.openedAt) {
    const openedAt = new Date();
    // two first reads at once open it once; the later one keeps the stamp the first wrote
    const res = await MissionState.updateOne(
      { userId, "roadmap.openedAt": null },
      { $set: { "roadmap.chapter": 1, "roadmap.openedAt": openedAt } }
    );
    if (res.modifiedCount) {
      roadmap.chapter = 1;
      roadmap.openedAt = openedAt;
    } else {
      Object.assign(roadmap, normalize(((await MissionState.findOne({ userId }, { roadmap: 1 }).lean()) || {}).roadmap));
    }
  }
  return { announced: doc.announced || [], roadmap };
}

// what the open chapter's ledger goals need, in one pass over the rows since it opened
async function ledgerSince(userId, since, goals) {
  const types = [...new Set(goals.flatMap((goal) => LEDGER_TYPES[goal] || []))];
  if (!types.length) return {};
  const [row] = await Transaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)), createdAt: { $gte: since }, type: { $in: types } } },
    {
      $group: {
        _id: null,
        fullPots: { $sum: { $cond: [{ $and: [{ $eq: ["$type", TX.BONUS] }, { $gte: ["$meta.fill", 1] }] }, 1, 0] } },
        bonusSpent: { $sum: { $cond: [{ $and: [{ $in: ["$type", STAKE_TYPES] }, { $gt: ["$meta.credit", 0] }] }, 1, 0] } },
        itemsSold: { $sum: { $cond: [{ $eq: ["$type", TX.ITEM_SELL] }, 1, 0] } },
        marketTrades: { $sum: { $cond: [{ $in: ["$type", TRADES] }, 1, 0] } },
        casesOpened: { $sum: { $cond: [{ $eq: ["$type", TX.CASE_OPEN] }, { $ifNull: ["$meta.quantity", 1] }, 0] } },
        staked: { $sum: { $cond: [{ $in: ["$type", STAKE_TYPES] }, "$amount", 0] } },
        games: { $addToSet: { $cond: [{ $in: ["$type", GAME_BETS] }, "$type", null] } },
        days: { $addToSet: { $cond: [{ $in: ["$type", STAKE_TYPES] }, { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, null] } },
        bigWin: { $max: { $cond: [{ $in: ["$type", GAME_WINS] }, "$amount", 0] } },
        rainsCaught: { $sum: { $cond: [{ $eq: ["$type", TX.RAIN_PAYOUT] }, 1, 0] } },
      },
    },
  ]);
  if (!row) return {};
  return { ...row, gamesTried: row.games.filter(Boolean).length, daysPlayed: row.days.filter(Boolean).length };
}

async function progressOf(user, roadmap, chapter, now = new Date()) {
  const goals = chapter.missions.map((m) => m.goal);
  const since = new Date(roadmap.openedAt);
  const needsCases = chapter.missions.some((m) => m.goal === "collectionsCompleted" && !roadmap.claimed.includes(m.key));
  const [ledger, battlesWon, casesDone, referrals, predictions] = await Promise.all([
    ledgerSince(user._id, since, goals),
    goals.includes("battlesWon") ? Battle.countDocuments({ winnerUserIds: user._id, status: "finished", finishedAt: { $gte: since } }) : 0,
    // one case's whole collection, the unit the Collections page shows, counted the moment it is held
    needsCases ? casesCompletedBy(user._id) : 0,
    // a friend counts once they reach level 10, the same bar the referral milestone pays at
    goals.includes("referrals") ? User.countDocuments({ referredBy: user._id, referralMilestonePaid: true }) : 0,
    goals.includes("predictions") ? PredictionTrade.countDocuments({ userId: user._id, createdAt: { $gte: since } }) : 0,
  ]);
  const valueOf = (mission) => {
    switch (mission.goal) {
      case "level": return user.level || 0;
      case "pinned": return user.fixedItem && user.fixedItem.name ? 1 : 0;
      case "discordLinked": return user.discordId && user.discordInGuild === true ? 1 : 0;
      case "giftStreak": return liveStreak(user.giftStreak, user.giftLastAt, now) || 0;
      case "topFan": return user.fanRank && user.fanRank.rank === 1 ? 1 : 0;
      case "collectionsCompleted": return casesDone;
      case "giftSpins": return user.giftLastAt && new Date(user.giftLastAt) >= since ? 1 : 0;
      case "battlesWon": return battlesWon;
      case "collectionVisits": return roadmap.visited.includes(mission.key) ? 1 : 0;
      case "referrals": return referrals;
      case "predictions": return predictions;
      default: return ledger[mission.goal] || 0;
    }
  };
  return chapter.missions.map((mission) => {
    const raw = valueOf(mission);
    const claimed = roadmap.claimed.includes(mission.key);
    const complete = claimed || raw >= mission.target;
    return {
      key: mission.key,
      goal: mission.goal,
      target: mission.target,
      reward: mission.reward,
      current: claimed ? mission.target : Math.min(raw, mission.target),
      complete,
      claimed,
      claimable: complete && !claimed,
    };
  });
}

const preview = (chapter) =>
  chapter && {
    chapter: chapter.chapter,
    bonus: chapter.bonus,
    missions: chapter.missions.map(({ key, goal, target, reward }) => ({ key, goal, target, reward })),
  };

async function viewOf(user, roadmap) {
  const chapter = chapterOf(roadmap.chapter);
  if (!chapter) return { chapter: roadmap.chapter, chapters: CHAPTERS.length, finished: true, bonus: 0, missions: [], next: null };
  return {
    chapter: chapter.chapter,
    chapters: CHAPTERS.length,
    finished: false,
    bonus: chapter.bonus,
    missions: await progressOf(user, roadmap, chapter),
    next: preview(chapterOf(chapter.chapter + 1)) || null,
  };
}

async function viewFor(user) {
  const { roadmap } = await stateOf(user._id);
  return viewOf(user, roadmap);
}

// claim one mission of the open chapter. the mark is the mutex, as with the achievements, and the
// claim that completes a chapter also pays its bonus and opens the next, guarded in the filter
async function claim(user, key) {
  const userId = user._id;
  const { roadmap } = await stateOf(userId);
  const chapter = chapterOf(roadmap.chapter);
  const mission = chapter && chapter.missions.find((m) => m.key === key);
  if (!mission) return { code: 404, body: { message: "Mission not found" } };

  const mine = (await progressOf(user, roadmap, chapter)).find((m) => m.key === key);
  if (mine.claimed) return { code: 200, body: { claimed: false, alreadyClaimed: true, roadmap: await viewFor(user) } };
  if (!mine.complete) return { code: 400, body: { message: "Mission not complete" } };

  const keys = chapter.missions.map((m) => m.key);
  let result;
  try {
    result = await runAtomic(async (session) => {
      const marked = await MissionState.updateOne(
        { userId, "roadmap.chapter": chapter.chapter, "roadmap.claimed": { $ne: key } },
        { $addToSet: { "roadmap.claimed": key } },
        { session }
      );
      if (marked.modifiedCount !== 1) return null;
      let credited = await creditUser(userId, mission.reward, 0, {
        type: TX.MISSION_REWARD,
        meta: { missionKey: key, roadmapChapter: chapter.chapter },
        session,
      });
      if (!credited) throw new Error("roadmap credit failed");
      const closed = await MissionState.updateOne(
        { userId, "roadmap.chapter": chapter.chapter, "roadmap.claimed": { $all: keys } },
        { $set: { "roadmap.chapter": chapter.chapter + 1, "roadmap.openedAt": new Date(), "roadmap.claimed": [], "roadmap.visited": [] } },
        { session }
      );
      let bonus = 0;
      if (closed.modifiedCount === 1) {
        credited = await creditUser(userId, chapter.bonus, 0, {
          type: TX.MISSION_REWARD,
          meta: { roadmapChapter: chapter.chapter, chapterBonus: true },
          session,
        });
        if (!credited) throw new Error("chapter bonus failed");
        bonus = chapter.bonus;
      }
      return { credited, bonus };
    });
  } catch (e) {
    console.error("roadmap claim failed:", e);
    return { code: 500, body: { message: "Could not claim the reward, please try again" } };
  }
  if (!result) return { code: 200, body: { claimed: false, alreadyClaimed: true, roadmap: await viewFor(user) } };

  const io = getIo();
  if (io) {
    io.to(String(userId)).emit("userDataUpdated", {
      walletBalance: result.credited.walletBalance,
      xp: result.credited.xp,
      level: result.credited.level,
    });
  }

  return {
    code: 200,
    body: {
      claimed: true,
      reward: mission.reward,
      walletBalance: result.credited.walletBalance,
      missionKey: key,
      chapterDone: result.bonus ? { chapter: chapter.chapter, bonus: result.bonus } : null,
      roadmap: await viewFor(user),
    },
  };
}

// a page reports what only it can see; it counts for a mission of that goal in the open chapter
async function visit(user, goal) {
  if (!VISIT_GOALS.includes(goal)) return { code: 400, body: { message: "Not a visit goal" } };
  const { roadmap } = await stateOf(user._id);
  const chapter = chapterOf(roadmap.chapter);
  const mission = chapter && chapter.missions.find((m) => m.goal === goal);
  if (!mission) return { code: 200, body: { recorded: false } };
  await MissionState.updateOne({ userId: user._id, "roadmap.chapter": chapter.chapter }, { $addToSet: { "roadmap.visited": mission.key } });
  return { code: 200, body: { recorded: true } };
}

// her missions that just became claimable, for the toast the achievements already use. what was
// complete when a chapter opened is recorded silently, so opening one never toasts a pile at once
async function pendingFor(user) {
  const userId = user._id;
  const { announced, roadmap } = await stateOf(userId);
  const chapter = chapterOf(roadmap.chapter);
  if (!chapter) return [];
  const done = (await progressOf(user, roadmap, chapter)).filter((m) => m.claimable);
  if (roadmap.seeded !== chapter.chapter) {
    const update = { $set: { "roadmap.seeded": chapter.chapter } };
    if (done.length) update.$addToSet = { announced: { $each: done.map((m) => m.key) } };
    await MissionState.updateOne({ userId }, update);
    return [];
  }
  const out = [];
  for (const m of done) {
    if (announced.includes(m.key)) continue;
    const res = await MissionState.updateOne({ userId, announced: { $ne: m.key } }, { $addToSet: { announced: m.key } });
    if (res.modifiedCount === 1) out.push({ key: m.key, reward: m.reward, target: m.target, roadmap: true });
  }
  return out;
}

module.exports = { viewFor, claim, visit, pendingFor };
