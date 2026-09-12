const crypto = require("crypto");
const POOL = require("../data/haloStudents.json");
const HaloDay = require("../models/HaloDay");
const HaloPlay = require("../models/HaloPlay");
const HaloStats = require("../models/HaloStats");
const Case = require("../models/Case");
const Item = require("../models/Item");
const { dayIndex } = require("./dailyGift");
const { creditUser, runAtomic, TX } = require("./economy");

const MAX_GUESSES = 10;
// an answer is not picked again while it is this recent
const NO_REPEAT_DAYS = 60;
// a win pays the base plus a share for every guess left over, and a streak adds on top.
// the most a day can pay is 1,500 KP, a rounding error next to the bonus pot.
const REWARD_BASE = 300;
const REWARD_PER_SPARE_GUESS = 70;
const STREAK_BONUS = 50;
const STREAK_BONUS_CAP = 500;
// puzzle #1 is the site day the arcade opened
const LAUNCH_DAY = dayIndex(new Date("2026-09-13T12:00:00Z"));

const BY_NAME = new Map(POOL.map((s) => [s.name.toLowerCase(), s]));
const studentByName = (name) => BY_NAME.get(String(name || "").trim().toLowerCase()) || null;

// what the search list carries: enough to draw a guess row, nothing a hint gives away. with
// the weapon or voice line in it, the first hint could be looked up instead of guessed.
const PUBLIC_FIELDS = ["name", "rarity", "type", "role", "attackType", "defenseType", "academy", "schoolYear", "age", "height", "studentImage"];
const publicStudent = (s) => Object.fromEntries(PUBLIC_FIELDS.map((f) => [f, s[f]]));
const PUBLIC_POOL = POOL.map(publicStudent);

const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯가-힯]/;
const isReadableHint = (text) => {
  const trimmed = String(text || "").trim();
  return !!trimmed && trimmed !== "Unknown" && !CJK.test(trimmed);
};
const isHaloAvailable = (url) => !!url && !url.includes("/student/icon/");

const censorName = (text, name) => {
  const base = String(name || "").split(/[(*]/)[0].trim();
  if (!text || !base) return text;
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "****");
};

// unknown on either side only matches unknown, otherwise the arrow points at the answer
const parseNumber = (value) => {
  const match = String(value ?? "").match(/(\d+)/);
  const n = match ? Number(match[1]) : -1;
  return n > 0 ? n : -1;
};
const numeric = (target, guess) => {
  if (target === -1 || guess === -1) return target === guess ? "CORRECT" : "WRONG";
  if (target === guess) return "CORRECT";
  return target > guess ? "HIGHER" : "LOWER";
};
const same = (a, b) => (a === b ? "CORRECT" : "WRONG");

function compare(target, guess) {
  return {
    student: publicStudent(guess),
    correct: guess.name === target.name,
    matches: {
      academy: same(target.academy, guess.academy),
      role: same(target.role, guess.role),
      type: same(target.type, guess.type),
      rarity: numeric(target.rarity, guess.rarity),
      attackType: same(target.attackType, guess.attackType),
      defenseType: same(target.defenseType, guess.defenseType),
      height: numeric(parseNumber(target.height), parseNumber(guess.height)),
      age: numeric(parseNumber(target.age), parseNumber(guess.age)),
      schoolYear: numeric(parseNumber(target.schoolYear), parseNumber(guess.schoolYear)),
    },
  };
}

// hints open one per miss. a student with no halo or no readable hobby moves the later ones
// up, so nobody waits a guess for a hint that is not there.
function hintsFor(target, attempts) {
  const halo = isHaloAvailable(target.haloImage);
  const hobby = isReadableHint(target.hobby);
  const description = isReadableHint(target.ssrDescription);
  const pre = halo ? 0 : 1;
  const post = pre + (hobby ? 0 : 1);
  const plan = [
    { key: "halo", unlockAt: 1, available: halo, value: () => ({ image: target.haloImage }) },
    { key: "hobby", unlockAt: 2 - pre, available: hobby, value: () => ({ text: target.hobby }) },
    { key: "weapon", unlockAt: 3 - post, available: !!target.gunImage, value: () => ({ image: target.gunImage }) },
    {
      key: "profile",
      unlockAt: 4 - post,
      available: true,
      value: () => ({ birthday: target.birthday, text: description ? censorName(target.ssrDescription, target.name) : null }),
    },
    { key: "gear", unlockAt: 5 - post, available: !!target.itemImage, value: () => ({ image: target.itemImage }) },
    { key: "voice", unlockAt: 6 - post, available: !!target.voiceline, value: () => ({ audio: target.voiceline }) },
    { key: "club", unlockAt: 7 - post, available: isReadableHint(target.club), value: () => ({ text: target.club }) },
  ];
  return plan.map((h) => {
    const unlocked = attempts >= h.unlockAt;
    return { key: h.key, unlockAt: h.unlockAt, unlocked, available: h.available, ...(unlocked && h.available ? h.value() : {}) };
  });
}

// the whole game from a list of names: unknown and repeated names are dropped, and nothing
// after the right answer or the tenth guess counts
function evaluate(target, names) {
  const seen = new Set();
  const guesses = [];
  for (const raw of Array.isArray(names) ? names : []) {
    const s = studentByName(raw);
    if (!s || seen.has(s.name)) continue;
    seen.add(s.name);
    guesses.push(compare(target, s));
    if (guesses.length >= MAX_GUESSES || s.name === target.name) break;
  }
  const won = guesses.length > 0 && guesses[guesses.length - 1].correct;
  const finished = won || guesses.length >= MAX_GUESSES;
  return {
    names: guesses.map((g) => g.student.name),
    guesses,
    won,
    lost: finished && !won,
    finished,
    hints: finished ? [] : hintsFor(target, guesses.length),
  };
}

const rewardFor = (guessCount, streak) =>
  REWARD_BASE +
  REWARD_PER_SPARE_GUESS * (MAX_GUESSES - guessCount + 1) +
  Math.min(STREAK_BONUS * Math.max(0, streak - 1), STREAK_BONUS_CAP);

const rewardTable = () => ({
  base: REWARD_BASE,
  perSpareGuess: REWARD_PER_SPARE_GUESS,
  streakBonus: STREAK_BONUS,
  streakBonusCap: STREAK_BONUS_CAP,
  best: rewardFor(1, 1),
});

const puzzleNumber = (day) => Math.max(1, day - LAUNCH_DAY + 1);

// days already asked for, so the page does not read the pick on every view. a past day with
// no row can never gain one, so that absence is remembered too.
const picks = new Map();
const noPick = new Set();

async function nameForDay(day, { create = true } = {}) {
  if (picks.has(day)) return picks.get(day);
  if (!create && noPick.has(day)) return null;
  let row = await HaloDay.findOne({ day }).select("name").lean();
  if (!row && create) {
    const recent = await HaloDay.find({ day: { $gte: day - NO_REPEAT_DAYS, $lt: day } }).select("name").lean();
    const taken = new Set(recent.map((r) => r.name));
    const fresh = POOL.filter((s) => !taken.has(s.name));
    const from = fresh.length ? fresh : POOL;
    const name = from[crypto.randomInt(from.length)].name;
    try {
      await HaloDay.updateOne({ day }, { $setOnInsert: { name } }, { upsert: true });
    } catch (err) {
      // two first views at once: the other one's pick stands
      if (err.code !== 11000) throw err;
    }
    row = await HaloDay.findOne({ day }).select("name").lean();
  }
  if (!row) {
    if (day < dayIndex(new Date())) noPick.add(day);
    return null;
  }
  if (picks.size > 16) picks.clear();
  picks.set(day, row.name);
  return row.name;
}

async function targetFor(day) {
  const name = await nameForDay(day);
  const target = name ? studentByName(name) : null;
  if (name && !target) console.error(`daily halo: ${name} is picked for day ${day} but no longer in the pool`);
  return target;
}

// the card this student is in the case shelves, so a finished game can point at it. the
// base card in a regular case wins over an alt in a festival one.
const cards = new Map();
async function cardFor(name) {
  if (cards.has(name)) return cards.get(name);
  try {
    const cases = await Case.find({ category: "Blue Archive" }).select("title slug image collectible").lean();
    const byId = new Map(cases.map((c) => [String(c._id), c]));
    const exact = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    const items = await Item.find({ case: { $in: cases.map((c) => c._id) }, $or: [{ name: exact }, { character: exact }] })
      .select("name image rarity case")
      .lean();
    const score = ({ item, box }) => (exact.test(item.name) ? 2 : 0) + (box.collectible !== false ? 1 : 0);
    const ranked = items
      .map((item) => ({ item, box: byId.get(String(item.case)) }))
      .filter((x) => x.box)
      .sort((a, b) => score(b) - score(a));
    const best = ranked[0];
    const card = best
      ? {
          itemId: String(best.item._id),
          name: best.item.name,
          image: best.item.image,
          rarity: best.item.rarity,
          caseId: String(best.box._id),
          caseSlug: best.box.slug || null,
          caseTitle: best.box.title,
          caseImage: best.box.image || null,
        }
      : null;
    if (cards.size > 16) cards.clear();
    cards.set(name, card);
    return card;
  } catch (err) {
    return null;
  }
}

async function reveal(target) {
  return {
    name: target.name,
    academy: target.academy,
    rarity: target.rarity,
    type: target.type,
    role: target.role,
    studentImage: target.studentImage,
    voiceline: target.voiceline,
    haloImage: isHaloAvailable(target.haloImage) ? target.haloImage : "",
    card: await cardFor(target.name),
  };
}

async function present(result, target, stored) {
  return {
    guesses: result.guesses,
    won: result.won,
    lost: result.lost,
    finished: result.finished,
    hints: result.hints,
    answer: result.finished ? await reveal(target) : null,
    reward: stored ? stored.reward || 0 : 0,
    adopted: !!(stored && stored.adopted),
  };
}

// a streak survives until the day after its last win, so a player who has not played yet
// today still sees the streak they can keep
const liveStats = (s, day) => ({
  played: (s && s.played) || 0,
  wins: (s && s.wins) || 0,
  currentStreak: s && s.lastWonDay >= day - 1 ? s.currentStreak || 0 : 0,
  bestStreak: (s && s.bestStreak) || 0,
  distribution: Array.from({ length: MAX_GUESSES }, (_, i) => (s && s.distribution && s.distribution[i]) || 0),
});

// one pipeline so the streak reads the stored last win and writes the new one together
const statsUpdate = (day, won, guessCount) => [
  {
    $set: {
      played: { $add: [{ $ifNull: ["$played", 0] }, 1] },
      wins: { $add: [{ $ifNull: ["$wins", 0] }, won ? 1 : 0] },
      currentStreak: won
        ? { $cond: [{ $eq: [{ $ifNull: ["$lastWonDay", -2] }, day - 1] }, { $add: [{ $ifNull: ["$currentStreak", 0] }, 1] }, 1] }
        : { $literal: 0 },
      lastWonDay: won ? { $literal: day } : { $ifNull: ["$lastWonDay", -1] },
      lastPlayedDay: { $literal: day },
      distribution: {
        $map: {
          input: { $range: [0, MAX_GUESSES] },
          as: "i",
          in: {
            $add: [
              { $ifNull: [{ $arrayElemAt: [{ $ifNull: ["$distribution", []] }, "$$i"] }, 0] },
              won ? { $cond: [{ $eq: ["$$i", guessCount - 1] }, 1, 0] } : 0,
            ],
          },
        },
      },
    },
  },
  { $set: { bestStreak: { $max: [{ $ifNull: ["$bestStreak", 0] }, "$currentStreak"] } } },
];

// closes a game exactly once: the finished flag is the guard, and the reward, the record and
// the day's tally commit with it
async function finalize(userId, day, result, { adopted = false } = {}) {
  const guessCount = result.guesses.length;
  const before = await HaloStats.findOne({ userId }).select("currentStreak lastWonDay").lean();
  const streak = result.won ? (before && before.lastWonDay === day - 1 ? (before.currentStreak || 0) + 1 : 1) : 0;
  const reward = result.won && !adopted ? rewardFor(guessCount, streak) : 0;

  return runAtomic(async (session) => {
    const play = await HaloPlay.findOneAndUpdate(
      { userId, day, finished: { $ne: true } },
      { $set: { finished: true, won: result.won, reward, adopted } },
      { new: true, session, lean: true }
    );
    if (!play) return null;
    if (reward > 0) {
      const paid = await creditUser(userId, reward, 0, {
        type: TX.ARCADE_REWARD,
        meta: { game: "daily-halo", day, guesses: guessCount, streak },
        session,
      });
      if (!paid) throw new Error("daily halo reward was not credited");
    }
    await HaloStats.updateOne({ userId }, statsUpdate(day, result.won, guessCount), { upsert: true, session });
    await HaloDay.updateOne(
      { day },
      { $inc: { plays: 1, solves: result.won ? 1 : 0, guessTotal: result.won ? guessCount : 0 } },
      { session }
    );
    return play;
  });
}

async function playerState(userId, day, target) {
  let [play, stats] = await Promise.all([
    HaloPlay.findOne({ userId, day }).lean(),
    HaloStats.findOne({ userId }).lean(),
  ]);
  const result = evaluate(target, play ? play.guesses : []);
  // a game whose last guess landed but whose close did not, from a crash between the two
  if (result.finished && play && !play.finished) {
    await finalize(userId, day, result, { adopted: play.adopted });
    [play, stats] = await Promise.all([HaloPlay.findOne({ userId, day }).lean(), HaloStats.findOne({ userId }).lean()]);
  }
  return { play: await present(result, target, play), stats: liveStats(stats, day) };
}

async function guess(userId, day, target, name) {
  let accepted = true;
  try {
    // the filter is the rulebook: not finished, not a repeat, not past the tenth guess. a row
    // that refuses sends the upsert into the unique index instead of making a second game.
    await HaloPlay.findOneAndUpdate(
      { userId, day, finished: { $ne: true }, guesses: { $ne: name }, [`guesses.${MAX_GUESSES - 1}`]: { $exists: false } },
      { $push: { guesses: name } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    accepted = false;
  }
  return { accepted, ...(await playerState(userId, day, target)) };
}

// a guest's game carried into the account at sign-in, once, and only if the account has no
// game today. a finished one keeps its record but pays nothing: the answer was already seen.
async function adopt(userId, day, target, names) {
  const result = evaluate(target, names);
  if (!result.guesses.length) return { adopted: false, ...(await playerState(userId, day, target)) };
  try {
    await HaloPlay.create({ userId, day, guesses: result.names, adopted: result.finished });
  } catch (err) {
    if (err.code !== 11000) throw err;
    return { adopted: false, ...(await playerState(userId, day, target)) };
  }
  if (result.finished) await finalize(userId, day, result, { adopted: true });
  return { adopted: true, ...(await playerState(userId, day, target)) };
}

// a guest finish counts toward the day's tally once per address; it is a crowd number, not
// a record, so an address shared by two people costing one count is fine
const guestFinishes = { day: -1, seen: new Set() };
async function countGuestFinish(day, address, result) {
  if (!result.finished || !address) return;
  if (guestFinishes.day !== day) {
    guestFinishes.day = day;
    guestFinishes.seen = new Set();
  }
  if (guestFinishes.seen.has(address)) return;
  guestFinishes.seen.add(address);
  await HaloDay.updateOne(
    { day },
    { $inc: { plays: 1, solves: result.won ? 1 : 0, guessTotal: result.won ? result.guesses.length : 0 } }
  );
}

async function summary(day) {
  const [today, yesterdayName] = await Promise.all([
    HaloDay.findOne({ day }).select("plays solves guessTotal").lean(),
    nameForDay(day - 1, { create: false }),
  ]);
  const solves = (today && today.solves) || 0;
  const yesterday = yesterdayName ? studentByName(yesterdayName) : null;
  return {
    plays: (today && today.plays) || 0,
    solves,
    averageGuesses: solves ? Math.round((today.guessTotal / solves) * 10) / 10 : null,
    yesterday: yesterday ? { name: yesterday.name, academy: yesterday.academy, studentImage: yesterday.studentImage } : null,
  };
}

// for tests, which share one module instance across a wiped database
const resetCaches = () => {
  picks.clear();
  noPick.clear();
  cards.clear();
  guestFinishes.day = -1;
  guestFinishes.seen = new Set();
};

module.exports = {
  MAX_GUESSES,
  NO_REPEAT_DAYS,
  POOL_SIZE: POOL.length,
  publicPool: () => PUBLIC_POOL,
  studentByName,
  isReadableHint,
  isHaloAvailable,
  censorName,
  compare,
  hintsFor,
  evaluate,
  rewardFor,
  rewardTable,
  puzzleNumber,
  nameForDay,
  targetFor,
  present,
  liveStats,
  playerState,
  guess,
  adopt,
  countGuestFinish,
  summary,
  resetCaches,
};
