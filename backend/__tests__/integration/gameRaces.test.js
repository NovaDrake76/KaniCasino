process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const crypto = require("crypto");

// pin the crash seed to a high crash point so a cashout at 1.0x is always in time, and
// skip generating a real 10k-seed chain under this suite's fake timers (mock-prefixed)
let mockHighSeed = null;
jest.mock("../../utils/gameChain", () => ({
  consumeNextSeed: jest.fn(async () => ({ seed: mockHighSeed, chainId: null, index: 0 })),
}));

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Round = require("../../models/Round");
const { crashPointFromSeed } = require("../../utils/crashMath");
const crashGame = require("../../games/crash");
const coinFlip = require("../../games/coinFlip");

for (let i = 0; mockHighSeed === null; i++) {
  const s = crypto.createHash("sha256").update(`gr:${i}`).digest("hex");
  if (crashPointFromSeed(s) >= 50) mockHighSeed = s;
}

beforeAll(setupDb);

// the round loop runs forever, so whatever a test starts is stopped when it ends
const running = [];
const start = (game, io) => {
  running.push(game(io));
};

// the game sets its in-memory bettingOpen flag and then broadcasts its opening state, so
// that broadcast is the signal a bet will be accepted. waiting on the round doc alone raced
// the flag: the doc could be visible a tick before bettingOpen flipped, and a bet placed in
// that window was refused, so nothing was charged. the findOne is what actually paces this
// loop (a real db round-trip lets openBetting's create finish); the emit is the gate.
// setImmediate is real here (the fake timers below leave it alone).
async function untilBettingOpens(emitted, event, game) {
  for (let i = 0; i < 500; i++) {
    if (emitted.includes(event)) return;
    await Round.findOne({ game, status: "betting" });
    await new Promise((r) => setImmediate(r));
  }
  throw new Error(`no ${event} broadcast`);
}

afterEach(async () => {
  while (running.length) running.pop()();
  await clearDb();
});
afterAll(teardownDb);

// a socket can emit the same event twice in one tick; these fakes let us fire the
// handlers exactly that way, which is how the duplicate-charge races were found
function fakeIo() {
  let onConnection;
  const emitted = [];
  const io = {
    on: (event, cb) => {
      if (event === "connection") onConnection = cb;
    },
    emit: (event) => emitted.push(event),
    to: () => ({ emit: () => {} }),
  };
  return { io, emitted, connect: (socket) => onConnection(socket) };
}

function fakeSocket(userId) {
  const handlers = {};
  return {
    userId: userId.toString(),
    handlers,
    on: (event, fn) => {
      handlers[event] = fn;
    },
    emit: () => {},
    join: () => {},
  };
}

async function makeUser(walletBalance) {
  const s = uniqueSuffix();
  return User.create({
    username: `racer-${s}`,
    email: `racer-${s}@example.com`,
    password: "x",
    walletBalance,
  });
}

describe("crash", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("a cashout emitted twice in one tick is only paid once", async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

    const user = await makeUser(1000);
    const { io, emitted, connect } = fakeIo();
    start(crashGame, io);
    await untilBettingOpens(emitted, "crash:gameState", "crash");
    const socket = fakeSocket(user._id);
    connect(socket);

    await socket.handlers["crash:bet"](100);
    expect((await User.findById(user._id)).walletBalance).toBe(900);

    jest.advanceTimersByTime(12000); // betting window closes, the round starts

    await Promise.all([
      socket.handlers["crash:cashout"](),
      socket.handlers["crash:cashout"](),
    ]);

    // paid the stake back exactly once (1100 would mean the mint is back)
    expect((await User.findById(user._id)).walletBalance).toBe(1000);
  });

  test("a bet emitted twice in one tick is only charged once", async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const user = await makeUser(1000);
    const { io, emitted, connect } = fakeIo();
    start(crashGame, io);
    await untilBettingOpens(emitted, "crash:gameState", "crash");
    const socket = fakeSocket(user._id);
    connect(socket);

    await Promise.all([
      socket.handlers["crash:bet"](100),
      socket.handlers["crash:bet"](100),
    ]);

    expect((await User.findById(user._id)).walletBalance).toBe(900);
  });
});

describe("coin flip", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("two bets in one tick cannot back both sides", async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const user = await makeUser(1000);
    const { io, emitted, connect } = fakeIo();
    start(coinFlip, io);
    await untilBettingOpens(emitted, "coinFlip:gameState", "coinflip");
    const socket = fakeSocket(user._id);
    connect(socket);

    await Promise.all([
      socket.handlers["coinFlip:bet"](100, 0), // heads
      socket.handlers["coinFlip:bet"](100, 1), // tails
    ]);

    // only one stake left the wallet: backing both sides was a risk-free xp and
    // weekly-winnings farm
    expect((await User.findById(user._id)).walletBalance).toBe(900);
  });
});
