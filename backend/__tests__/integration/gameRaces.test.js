process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// pin the round to a high crash point so a cashout at 1.0x is always in time
jest.mock("../../utils/crashMath", () => ({
  ...jest.requireActual("../../utils/crashMath"),
  crashPointFromRandom: () => 99,
  INSTANT_CRASH_CHANCE: 0,
}));

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const crashGame = require("../../games/crash");
const coinFlip = require("../../games/coinFlip");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

// a socket can emit the same event twice in one tick; these fakes let us fire the
// handlers exactly that way, which is how the duplicate-charge races were found
function fakeIo() {
  let onConnection;
  const io = {
    on: (event, cb) => {
      if (event === "connection") onConnection = cb;
    },
    emit: () => {},
    to: () => ({ emit: () => {} }),
  };
  return { io, connect: (socket) => onConnection(socket) };
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
    const { io, connect } = fakeIo();
    crashGame(io);
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
    const { io, connect } = fakeIo();
    crashGame(io);
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
    const { io, connect } = fakeIo();
    coinFlip(io);
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
