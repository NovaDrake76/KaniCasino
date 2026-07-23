process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const crypto = require("crypto");

// pin each game's seed so its outcome is known (jest only allows mock-prefixed vars here)
let mockCrashSeed = null;
let mockCoinSeed = null;
jest.mock("../../utils/gameChain", () => ({
  consumeNextSeed: jest.fn(async (game) => ({
    seed: game === "coinflip" ? mockCoinSeed : mockCrashSeed,
    chainId: null,
    index: 0,
  })),
}));

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Round = require("../../models/Round");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");
const { crashPointFromSeed } = require("../../utils/crashMath");
const { coinResultFromSeed } = require("../../utils/coinMath");
const crashGame = require("../../games/crash");
const coinFlip = require("../../games/coinFlip");

const seedBy = (hash, pred) => {
  for (let i = 0; i < 200000; i++) {
    const s = crypto.createHash("sha256").update(`rr:${i}`).digest("hex");
    if (pred(hash(s))) return s;
  }
  throw new Error("no seed found");
};
const INSTANT_SEED = seedBy(crashPointFromSeed, (cp) => cp === 1.0);
const RUNNING_SEED = seedBy(crashPointFromSeed, (cp) => cp >= 3);
const HEADS_SEED = seedBy(coinResultFromSeed, (r) => r === 0);
mockCrashSeed = RUNNING_SEED; // defaults so a round always has a valid seed
mockCoinSeed = HEADS_SEED;

// real timers throughout: faking the clock stops the mongo driver's own timers and every
// query then times out. the games take their timings as arguments instead, so a whole
// round runs in milliseconds.
const FAST_CRASH = { bettingMs: 60, tickMs: 5, retryMs: 20 };
const FAST_FLIP = { bettingMs: 60, revealMs: 40, retryMs: 20 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// polls instead of guessing a duration: the whole suite runs in parallel, so a fixed
// wait that passes alone is a coin toss under load
async function until(check, what, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await wait(5);
  }
  throw new Error(`timed out waiting for ${what}`);
}

const roundIn = (game, status) => () => Round.findOne({ game, status });

beforeAll(setupDb);

// the round loop runs forever, so anything a test starts is stopped before the database
// goes away underneath it
const running = [];
const start = (game, io, opts) => {
  const stop = game(io, opts);
  running.push(stop);
  return stop;
};

afterEach(async () => {
  while (running.length) running.pop()();
  jest.restoreAllMocks();
  await clearDb();
});
afterAll(teardownDb);

const makeUser = (walletBalance = 5000) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
};

const makeIo = () => {
  const io = {
    connection: null,
    on: (event, fn) => { if (event === "connection") io.connection = fn; },
    emit: () => {},
    to: () => ({ emit: () => {} }),
  };
  return io;
};

const makeSocket = (userId) => {
  const handlers = {};
  return { userId, handlers, on: (e, fn) => { handlers[e] = fn; }, emit: () => {} };
};

// place a bet during a betting window, retrying across windows if one closes first under
// load. returns the round the bet actually landed on, so assertions target the right one.
async function betOnRound(game, event, socket, args) {
  for (let attempt = 0; attempt < 200; attempt++) {
    await until(roundIn(game, "betting"), `${game} betting to open`);
    let reply;
    await socket.handlers[event](...args, (r) => { reply = r; });
    if (reply && reply.ok) {
      return until(
        () => Round.findOne({ game, "bets.userId": socket.userId }),
        `${game} round holding the bet`
      );
    }
    await wait(10);
  }
  throw new Error(`could not place a ${game} bet`);
}

const settledById = (id) => async () => {
  const r = await Round.findById(id);
  return r && r.status === "settled" ? r : null;
};

test("crash writes a round, ties the stake to it, and settles it at the bust", async () => {
  // a seed whose crash point is 1.0, so the round busts instantly and settles at once
  mockCrashSeed = INSTANT_SEED;
  const user = await makeUser(5000);
  const io = makeIo();

  start(crashGame, io, FAST_CRASH);
  const socket = makeSocket(String(user._id));
  io.connection(socket);
  const opened = await betOnRound("crash", "crash:bet", socket, [100]);

  // the stake is on the round, and the ledger row points back at it
  expect(opened.bets).toHaveLength(1);
  expect(opened.bets[0].amount).toBe(100);
  expect(String(opened.bets[0].userId)).toBe(String(user._id));

  const betTx = await Transaction.findOne({ userId: user._id, type: TX.CRASH_BET });
  expect(betTx.meta.roundId).toBe(String(opened._id));

  const done = await until(settledById(opened._id), "the crash round to bust and settle");
  expect(done.outcome.crashPoint).toBe(1);
  expect(done.bets[0].payout).toBe(0); // an instant bust pays nobody
});

test("an auto cashout pays at exactly its target", async () => {
  // a seed with a high crash point, and a low target: the curve grows in real time
  // (1.05x lands ~0.8s in), so the test never has to wait out a whole round
  mockCrashSeed = RUNNING_SEED;
  const user = await makeUser(5000);
  const io = makeIo();

  start(crashGame, io, FAST_CRASH);
  const socket = makeSocket(String(user._id));
  io.connection(socket);
  const opened = await betOnRound("crash", "crash:bet", socket, [
    { amount: 100, autoCashoutAt: 1.05 },
  ]);

  const paid = await until(async () => {
    const r = await Round.findById(opened._id);
    return r && r.bets[0] && r.bets[0].payout > 0 ? r : null;
  }, "the auto cashout to land on the round");
  // paid at the target, not at whatever multiplier the tick happened to see
  expect(paid.bets[0].multiplier).toBe(1.05);
  expect(paid.bets[0].payout).toBeCloseTo(105, 6);
  const tx = await Transaction.findOne({ userId: user._id, type: TX.CRASH_CASHOUT });
  expect(tx.amount).toBeCloseTo(105, 6);
  expect(tx.meta.multiplier).toBe(1.05);
});

test("a bad auto-cashout target refuses the bet before any money moves", async () => {
  mockCrashSeed = RUNNING_SEED;
  const user = await makeUser(5000);
  const io = makeIo();

  start(crashGame, io, FAST_CRASH);
  const socket = makeSocket(String(user._id));
  io.connection(socket);

  await until(roundIn("crash", "betting"), "crash betting to open");
  let reply;
  await socket.handlers["crash:bet"]({ amount: 100, autoCashoutAt: 0.5 }, (r) => { reply = r; });
  expect(reply.error).toBeTruthy();
  expect(await Transaction.findOne({ userId: user._id, type: TX.CRASH_BET })).toBeNull();
});

test("a crash cashout is recorded on the round", async () => {
  // a seed with a high crash point, so the round is comfortably still running at cashout
  mockCrashSeed = RUNNING_SEED;
  const user = await makeUser(5000);
  const io = makeIo();

  start(crashGame, io, { bettingMs: 60, tickMs: 5, retryMs: 20 });
  const socket = makeSocket(String(user._id));
  io.connection(socket);
  const opened = await betOnRound("crash", "crash:bet", socket, [100]);

  await until(async () => {
    const r = await Round.findById(opened._id);
    return r && r.status === "running" ? r : null;
  }, "the crash round to start");
  await socket.handlers["crash:cashout"](() => {});

  const cashed = await Round.findById(opened._id);
  expect(cashed.bets[0].payout).toBeGreaterThan(0);
  expect(cashed.bets[0].multiplier).toBeGreaterThan(1);
  expect(cashed.bets[0].settledAt).toBeTruthy();
  const tx = await Transaction.findOne({ userId: user._id, type: TX.CRASH_CASHOUT });
  expect(tx.meta.roundId).toBe(String(opened._id));
});

test("coin flip writes a round, records the side, and settles after the toss", async () => {
  // the seed is pinned to heads, so the bettor on heads wins
  const user = await makeUser(5000);
  const io = makeIo();

  start(coinFlip, io, FAST_FLIP);
  const socket = makeSocket(String(user._id));
  io.connection(socket);
  const opened = await betOnRound("coinflip", "coinFlip:bet", socket, [100, 0]);

  expect(opened.bets[0].side).toBe("heads");
  expect(opened.bets[0].amount).toBe(100);

  const settled = await until(settledById(opened._id), "the coin flip to land and pay out");
  expect(settled.outcome.winningSide).toBe("heads");
  expect(settled.bets[0].payout).toBe(194);
  expect((await User.findById(user._id)).walletBalance).toBe(5000 - 100 + 194);
});

test("no stake is taken while the round record cannot be written", async () => {
  const user = await makeUser(5000);
  const io = makeIo();
  jest.spyOn(Round, "create").mockRejectedValue(new Error("mongo is down"));
  jest.spyOn(console, "log").mockImplementation(() => {});

  start(crashGame, io, { bettingMs: 60, tickMs: 5, retryMs: 100000 });
  await wait(60); // nothing to wait for: the point is that no round is ever written

  const socket = makeSocket(String(user._id));
  io.connection(socket);
  let reply;
  await socket.handlers["crash:bet"](100, (r) => { reply = r; });

  // refusing the bet is the point: a stake with nothing to account it against is
  // exactly what a restart cannot give back
  expect(reply).toEqual({ error: "Betting is closed for this round" });
  expect((await User.findById(user._id)).walletBalance).toBe(5000);
  expect(await Transaction.countDocuments({ userId: user._id })).toBe(0);
});
