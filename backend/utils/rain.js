const RainRound = require("../models/RainRound");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const realtime = require("./realtime");
const badges = require("./badges");
const { creditUser, TX } = require("./economy");
const { HOUSE } = require("./accounts");
const { VISIBLE } = require("./visibility");

// the rain. every half hour a share of what the site wagered is split between whoever was
// in the chat for it. it is rakeback, the same as the daily board: the pool comes out of
// the house edge rather than being minted, and it is derived from the ledger rather than
// accumulated, so nothing on the betting path has to be touched to feed it.
const INTERVAL_MS = Number(process.env.RAIN_INTERVAL_MS || 30 * 60 * 1000);
// the share of turnover that falls into the pool. the house keeps an edge of roughly 1 to
// 4 percent depending on the game, so this hands a slice of it back rather than printing.
const RATE = Number(process.env.RAIN_RATE || 0.005);
// paying a handful of KP between forty people is not a prize, it is a rounding error.
// under this the pool rolls into the next round instead.
const MIN_POOL = Number(process.env.RAIN_MIN_POOL || 100);
// and no single round hands over a fortune because one whale had a session
const MAX_POOL = Number(process.env.RAIN_MAX_POOL || 25000);
// the rain is a bonus, not an income. whatever the pool is worth, nobody walks a balance
// out of it: a huge session with one new joiner in the room must not make that joiner rich
// by accident. what the cap refuses rides into the next round.
const MAX_PER_PLAYER = Number(process.env.RAIN_MAX_PER_PLAYER || 2000);
// a level is months of play, so it takes a bigger share. the curve is deliberately flat:
// weighting straight by level would let one veteran take the whole room's pool.
const LEVEL_CAP = Number(process.env.RAIN_LEVEL_CAP || 100);
const weightFor = (level) => 1 + Math.min(Math.max(level || 0, 0), LEVEL_CAP) / 50;
// higher than the chat's gate, and deliberately not inherited from it: talking costs
// nothing, and this pays out. about 1,490 KP wagered, which is a few bonus claims of real
// play rather than the minute it takes to make another account.
const MIN_LEVEL = Number(process.env.RAIN_MIN_LEVEL || 10);

const WAGER_TYPES = [
  TX.CASE_OPEN, TX.SLOT_BET, TX.PLINKO_BET, TX.CRASH_BET, TX.COINFLIP_BET,
  TX.BATTLE_ENTRY, TX.BLACKJACK_BET, TX.DICE_BET, TX.MINES_BET, TX.HILO_BET,
];

const CARD = "username slug profilePicture level fanRank selectedBadge badges";

// the open round, created on demand. a restart mid-round finds the row rather than
// starting a fresh half hour, so the countdown does not reset on every deploy.
async function currentRound(now = new Date()) {
  const open = await RainRound.findOne({ settledAt: null }).sort({ endsAt: 1 });
  if (open) return open;

  const last = await RainRound.findOne({ settledAt: { $ne: null } }).sort({ endsAt: -1 }).lean();
  // whatever the shares could not take rides in: nobody joined, the pool was dust, or
  // every share hit the per-player cap
  const carriedIn = last ? Math.max(0, (last.pool || 0) - (last.paidOut || 0)) : 0;
  // and so do the people. a round that paid nobody must not throw their join away: at this
  // traffic most windows are under the floor, so a player joined, waited out the clock,
  // got nothing, and had to join again to keep waiting. they were in the room; they stay
  // in it until a round actually falls, which is what resets the list.
  const joiners = last && !last.paidOut ? last.joiners || [] : [];
  return RainRound.create({
    startsAt: now,
    endsAt: new Date(now.getTime() + INTERVAL_MS),
    carriedIn,
    joiners,
  });
}

// one grouped read over the window's stake rows, which is tens to hundreds of documents at
// this traffic. it is never on a request path without the cache below.
async function poolFor(round) {
  const rows = await Transaction.aggregate([
    {
      $match: {
        type: { $in: WAGER_TYPES },
        createdAt: { $gte: round.startsAt, $lt: round.endsAt },
      },
    },
    { $group: { _id: null, wagered: { $sum: "$amount" } } },
  ]);
  const wagered = rows.length ? rows[0].wagered : 0;
  return Math.min(MAX_POOL, Math.floor(wagered * RATE) + (round.carriedIn || 0));
}

// the pool only moves when somebody bets, so it is cached rather than re-aggregated for
// every panel that asks
let cache = { at: 0, roundId: null, pool: 0 };
const CACHE_MS = 15000;

async function cachedPool(round) {
  const id = String(round._id);
  if (cache.roundId === id && Date.now() - cache.at < CACHE_MS) return cache.pool;
  const pool = await poolFor(round);
  cache = { at: Date.now(), roundId: id, pool };
  return pool;
}

async function state(userId) {
  const round = await currentRound();
  const pool = await cachedPool(round);
  return {
    roundId: String(round._id),
    startsAt: round.startsAt,
    endsAt: round.endsAt,
    // the countdown runs off this, so a wrong device clock cannot skew it
    serverTime: new Date(),
    pool,
    joined: !!userId && round.joiners.some((id) => String(id) === String(userId)),
    minLevel: MIN_LEVEL,
    maxPerPlayer: MAX_PER_PLAYER,
    // the floor, so the panel can say a pool is still building rather than showing a
    // countdown to nothing happening
    minPool: MIN_POOL,
    intervalMs: INTERVAL_MS,
  };
}

// joining is idempotent: the guard is in the query, so two clicks cannot enter twice
async function join(userId) {
  if (!userId) return { error: "auth" };
  const user = await User.findById(userId).select("level disabled").lean();
  if (!user) return { error: "auth" };
  if (user.disabled) return { error: "banned" };
  if ((user.level || 0) < MIN_LEVEL) return { error: "level", minLevel: MIN_LEVEL };

  const round = await currentRound();
  await RainRound.updateOne(
    { _id: round._id, settledAt: null, joiners: { $ne: userId } },
    { $push: { joiners: userId } }
  );
  return state(userId);
}

// who gets what. weighted by level, then capped, so a big pool with one small joiner pays
// that joiner the cap and carries the rest rather than handing them a fortune.
function splitPool(pool, people) {
  if (!(pool >= MIN_POOL) || !people.length) return [];
  const weights = people.map((person) => weightFor(person.level));
  const total = weights.reduce((a, b) => a + b, 0);
  return people
    .map((person, i) => ({
      userId: String(person._id),
      level: person.level || 0,
      amount: Math.min(MAX_PER_PLAYER, Math.floor((pool * weights[i]) / total)),
    }))
    .filter((share) => share.amount > 0);
}

// pay the round out and open the next one. the claim is the settledAt write, so two boxes
// racing the same round cannot both pay it.
async function settle(now = new Date()) {
  const round = await RainRound.findOne({ settledAt: null, endsAt: { $lte: now } }).sort({ endsAt: 1 });
  if (!round) return null;

  const pool = await poolFor(round);
  const joiners = round.joiners.map(String);

  // levels only, and only for the people in this round, which is tens of documents
  const people = joiners.length
    ? await User.find({ _id: { $in: joiners } }).select("level").lean()
    : [];
  const shares = splitPool(pool, people);
  const paidOut = shares.reduce((sum, share) => sum + share.amount, 0);

  const claimed = await RainRound.findOneAndUpdate(
    { _id: round._id, settledAt: null },
    { $set: { settledAt: now, pool, paidOut } },
    { new: true }
  );
  if (!claimed) return null; // another box got there first

  const paid = [];
  for (const share of shares) {
    try {
      await creditUser(share.userId, share.amount, 0, {
        type: TX.RAIN_PAYOUT,
        counterparty: HOUSE,
        meta: { roundId: String(round._id), joiners: joiners.length, pool, level: share.level },
      });
      paid.push(share);
    } catch (err) {
      // one failed credit must not cost everyone else theirs
      console.error("rain payout:", share.userId, err.message);
    }
  }

  resetCache();
  const next = await currentRound(now);
  const io = realtime.getIo();
  if (io) {
    io.emit("rain:settled", {
      roundId: String(round._id),
      pool,
      paidOut,
      winners: await winnerCards(paid.map((share) => share.userId)),
      next: { roundId: String(next._id), endsAt: next.endsAt, pool: next.carriedIn || 0 },
    });
    for (const share of paid) {
      io.to(String(share.userId)).emit("rain:won", {
        amount: share.amount,
        roundId: String(round._id),
      });
    }
  }
  return { pool, paidOut, paid: paid.length };
}

// a few names to show in the chat, never the whole list
async function winnerCards(ids) {
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids.slice(0, 8) }, ...VISIBLE })
    .select(CARD)
    .lean();
  return users.map((u) => ({
    _id: String(u._id),
    username: u.username,
    profilePicture: u.profilePicture || null,
    level: u.level || 0,
    badge: badges.wornBadge(u) || null,
  }));
}

// the pool only moves when somebody bets, and the panel has no other way to learn that it
// has. one broadcast per cache window, and only when the figure actually changed.
let announced = { roundId: null, pool: -1 };

async function broadcastPool() {
  const io = realtime.getIo();
  if (!io) return;
  const round = await currentRound();
  const pool = await cachedPool(round);
  const id = String(round._id);
  if (announced.roundId === id && announced.pool === pool) return;
  announced = { roundId: id, pool };
  io.emit("rain:pool", { roundId: id, pool, endsAt: round.endsAt });
}

// checked on a timer rather than scheduled for a fixed instant, so a restart mid-round
// settles the moment it comes back rather than skipping the round entirely
function start() {
  const tick = async () => {
    try {
      await settle();
      await broadcastPool();
    } catch (err) {
      console.error("rain tick:", err.message);
    }
  };
  tick();
  const timer = setInterval(tick, CACHE_MS);
  if (timer.unref) timer.unref();
  return () => clearInterval(timer);
}

function resetCache() {
  cache = { at: 0, roundId: null, pool: 0 };
  announced = { roundId: null, pool: -1 };
}

module.exports = {
  state, join, settle, start, currentRound, poolFor, splitPool, weightFor, resetCache,
  INTERVAL_MS, RATE, MIN_POOL, MAX_POOL, MAX_PER_PLAYER, MIN_LEVEL, LEVEL_CAP, WAGER_TYPES,
};
