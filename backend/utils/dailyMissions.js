const MissionState = require("../models/MissionState");
const { creditUser, runAtomic, TX } = require("./economy");
const { DAY_MS, dayOf, missionsOn, sizedFor } = require("./dailyCatalog");
const { ledgerSince } = require("./roadmap");
const { getIo } = require("./realtime");
const limits = require("./limits");
const verification = require("./verification");

const BET_OF = {
  dice: TX.DICE_BET,
  plinko: TX.PLINKO_BET,
  slots: TX.SLOT_BET,
  mines: TX.MINES_BET,
  hilo: TX.HILO_BET,
  blackjack: TX.BLACKJACK_BET,
  crash: TX.CRASH_BET,
  coinflip: TX.COINFLIP_BET,
};

const dayKey = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);

const pinned = (doc, key) => (doc && doc.daily && doc.daily.day === key && typeof doc.daily.level === "number" ? doc.daily : null);

// the day's record: what was claimed, and the level its rewards and targets are sized at. the first look of a day pins the
// level, so a level gained in the afternoon never moves a goal the player was halfway through
async function recordOf(user, day) {
  const userId = user._id;
  const key = dayKey(day);
  const found = pinned(await MissionState.findOne({ userId }, { daily: 1 }).lean(), key);
  if (found) return found;
  const level = Math.max(0, Math.floor(user.level || 0));
  await MissionState.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true });
  await MissionState.updateOne({ userId, "daily.day": { $ne: key } }, { $set: { daily: { day: key, claimed: [], level } } });
  await MissionState.updateOne({ userId, "daily.day": key, "daily.level": { $exists: false } }, { $set: { "daily.level": level } });
  return pinned(await MissionState.findOne({ userId }, { daily: 1 }).lean(), key) || { day: key, claimed: [], level };
}

// one ledger read over the account's rows since midnight; the day is the ledger's own, so it is never folded yet
async function progressOf(user, day, record) {
  const claimed = record.claimed || [];
  const missions = missionsOn(day).map((m) => sizedFor(m, record.level));
  const since = new Date(day * DAY_MS);
  const ledger = await ledgerSince(user._id, since, missions.map((m) => m.goal));
  const valueOf = (mission) => {
    if (mission.goal === "giftSpins") return user.giftLastAt && new Date(user.giftLastAt) >= since ? 1 : 0;
    if (mission.goal === "rounds") return ledger.rounds[BET_OF[mission.game]] || 0;
    return ledger[mission.goal] || 0;
  };
  return missions.map((mission) => {
    const raw = valueOf(mission);
    const done = claimed.includes(mission.key);
    const complete = done || raw >= mission.target;
    return {
      key: mission.key,
      goal: mission.goal,
      game: mission.game || null,
      target: mission.target,
      reward: mission.reward,
      current: done ? mission.target : Math.min(raw, mission.target),
      complete,
      claimed: done,
      claimable: complete && !done,
    };
  });
}

async function viewFor(user, now = new Date()) {
  const day = dayOf(now);
  return {
    day: dayKey(day),
    resetsAt: new Date((day + 1) * DAY_MS).toISOString(),
    missions: await progressOf(user, day, await recordOf(user, day)),
  };
}

// a repeating mint, so it is for accounts the rain would pay too. the mark is the mutex, as with every mission, and it only
// lands on the day's record, so a claim racing midnight finds nothing to mark rather than paying into the wrong day
async function claim(user, key, now = new Date()) {
  const userId = user._id;
  const day = dayOf(now);
  const mission = missionsOn(day).find((m) => m.key === key);
  if (!mission) return { code: 404, body: { message: "Mission not found" } };
  const locked = limits.lockFor(user) || verification.lockFor(user, now);
  if (locked) return { code: 403, body: locked };

  const record = await recordOf(user, day);
  const mine = (await progressOf(user, day, record)).find((m) => m.key === key);
  if (mine.claimed) return { code: 200, body: { claimed: false, alreadyClaimed: true, daily: await viewFor(user, now) } };
  if (!mine.complete) return { code: 400, body: { message: "Mission not complete" } };

  let credited;
  try {
    credited = await runAtomic(async (session) => {
      const marked = await MissionState.updateOne(
        { userId, "daily.day": dayKey(day), "daily.claimed": { $ne: key } },
        { $addToSet: { "daily.claimed": key } },
        { session }
      );
      if (marked.modifiedCount !== 1) return null;
      const paid = await creditUser(userId, mine.reward, 0, {
        type: TX.MISSION_REWARD,
        meta: { missionKey: key, daily: dayKey(day), level: record.level },
        session,
      });
      if (!paid) throw new Error("daily credit failed");
      return paid;
    });
  } catch (e) {
    console.error("daily claim failed:", e);
    return { code: 500, body: { message: "Could not claim the reward, please try again" } };
  }
  if (!credited) return { code: 200, body: { claimed: false, alreadyClaimed: true, daily: await viewFor(user, now) } };

  const io = getIo();
  if (io) {
    io.to(String(userId)).emit("userDataUpdated", { walletBalance: credited.walletBalance, xp: credited.xp, level: credited.level });
  }
  return {
    code: 200,
    body: { claimed: true, reward: mine.reward, walletBalance: credited.walletBalance, missionKey: key, daily: await viewFor(user, now) },
  };
}

module.exports = { viewFor, claim };
