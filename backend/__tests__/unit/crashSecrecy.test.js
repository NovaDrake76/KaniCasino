// pins the round to a known crash point. getRandomValues is a non-configurable
// property on the real module, so it has to be replaced at require time.
jest.mock("crypto", () => {
  const actual = jest.requireActual("crypto");
  return {
    ...actual,
    getRandomValues: (arr) => {
      arr[0] = 3229298719;
      return arr;
    },
  };
});

// what the wallet does is irrelevant to what the server broadcasts, so stubbing it
// keeps this test free of a database and lets the round run on fake timers
jest.mock("../../utils/economy", () => ({
  chargeUser: jest.fn(async (userId) => ({
    _id: userId,
    username: "player",
    profilePicture: "",
    level: 1,
    fixedItem: null,
    walletBalance: 500,
    xp: 0,
  })),
  creditUser: jest.fn(async (userId) => ({
    _id: userId,
    username: "player",
    walletBalance: 900,
    xp: 0,
    level: 1,
  })),
  TX: { CRASH_BET: "crash_bet", CRASH_CASHOUT: "crash_cashout" },
}));

const crashGame = require("../../games/crash");
const { crashPointFromRandom } = require("../../utils/crashMath");

// picked so the round crashes at 4.00x: high enough that a cashout five seconds in
// (1.35x) is still comfortably inside the round
const H = 3229298719;
const REAL_CRASH_POINT = crashPointFromRandom(H);

// records everything the server puts on the wire. the clone matters: gameState is one
// object mutated in place, and socket.io serializes at emit time, so holding the
// reference would rewrite history.
const makeIo = () => {
  const broadcasts = [];
  const io = {
    connection: null,
    on: (event, fn) => {
      if (event === "connection") io.connection = fn;
    },
    emit: (event, payload) =>
      broadcasts.push({ event, payload: JSON.parse(JSON.stringify(payload ?? null)) }),
    to: () => ({ emit: () => {} }),
    broadcasts,
  };
  return io;
};

const makeSocket = (userId) => {
  const handlers = {};
  return { userId, handlers, on: (e, fn) => { handlers[e] = fn; }, emit: () => {} };
};

describe("crash round secrecy", () => {
  let io;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0.99); // above INSTANT_CRASH_CHANCE
    io = makeIo();
    crashGame(io);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("the crash point is never broadcast while the round is still running", async () => {
    const alice = makeSocket("alice");
    const bob = makeSocket("bob");
    io.connection(alice);
    io.connection(bob);

    await alice.handlers["crash:bet"](100, () => {});
    await bob.handlers["crash:bet"](100, () => {});

    // start the round: from here the server knows where it crashes
    await jest.advanceTimersByTimeAsync(12000);
    // climb to ~1.35x, far short of 4.00x
    await jest.advanceTimersByTimeAsync(5000);

    // alice takes her money out. bob is still in the round and must learn nothing.
    await alice.handlers["crash:cashout"](() => {});

    // sanity: the round really was still live when she cashed out
    expect(REAL_CRASH_POINT).toBe(4);

    const leaks = io.broadcasts.filter(
      (b) => b.payload && b.payload.crashPoint === REAL_CRASH_POINT
    );
    expect(leaks).toEqual([]);
  });
});
