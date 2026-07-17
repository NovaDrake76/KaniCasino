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
const { creditUser } = require("../../utils/economy");
const { crashPointFromRandom, GROWTH } = require("../../utils/crashMath");

// picked so the round crashes at 4.00x: high enough that a cashout five seconds in
// (1.35x) is still comfortably inside the round
const REAL_CRASH_POINT = crashPointFromRandom(3229298719);
const BETTING_WINDOW = 12000;
// exp(t * GROWTH) reaches 4.00x at ~23.1s, so this always outlives the round
const WHOLE_ROUND = 24000;

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

const lastState = (io) => {
  const states = io.broadcasts.filter((b) => b.event === "crash:gameState");
  return states[states.length - 1].payload;
};

describe("crash rounds", () => {
  let io;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0.99); // above INSTANT_CRASH_CHANCE
    creditUser.mockClear();
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
    await jest.advanceTimersByTimeAsync(BETTING_WINDOW);
    // climb to ~1.35x, far short of 4.00x
    await jest.advanceTimersByTimeAsync(5000);

    // alice takes her money out. bob is still in the round and must learn nothing.
    await alice.handlers["crash:cashout"](() => {});

    // sanity: the round really was still live when she cashed out
    expect(REAL_CRASH_POINT).toBe(4);
    expect(lastState(io).gamePlayers.bob.payout).toBeNull();

    const leaks = io.broadcasts.filter(
      (b) => b.payload && b.payload.crashPoint === REAL_CRASH_POINT
    );
    expect(leaks).toEqual([]);
  });

  test("a bet is still visible to everyone, and pays stake * multiplier on cashout", async () => {
    const alice = makeSocket("alice");
    io.connection(alice);

    await alice.handlers["crash:bet"](100, () => {});

    const betting = lastState(io);
    expect(betting.gameBets.alice).toBe(100);
    expect(betting.gamePlayers.alice.username).toBe("player");
    expect(betting.gamePlayers.alice.payout).toBeNull();
    expect(betting).not.toHaveProperty("crashPoint");

    await jest.advanceTimersByTimeAsync(BETTING_WINDOW);
    await jest.advanceTimersByTimeAsync(5000);
    await alice.handlers["crash:cashout"](() => {});

    const expectedMultiplier = Math.exp(5 * GROWTH); // ~1.3499x
    expect(creditUser).toHaveBeenCalledTimes(1);
    const [userId, payout, winnings] = creditUser.mock.calls[0];
    expect(userId).toBe("alice");
    expect(payout).toBeCloseTo(100 * expectedMultiplier, 5);
    expect(winnings).toBeCloseTo(100 * expectedMultiplier - 100, 5);

    // her locked-in payout is public; the crash point still is not
    const cashedOut = lastState(io);
    expect(cashedOut.gamePlayers.alice.payout).toBeCloseTo(expectedMultiplier, 5);
    expect(cashedOut).not.toHaveProperty("crashPoint");
  });

  test("clients still get a climbing multiplier during the round", async () => {
    await jest.advanceTimersByTimeAsync(BETTING_WINDOW);
    await jest.advanceTimersByTimeAsync(5000);

    const ticks = io.broadcasts.filter((b) => b.event === "crash:multiplier").map((b) => b.payload);
    expect(ticks.length).toBeGreaterThan(50);
    expect(ticks[0]).toBeGreaterThanOrEqual(1);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(ticks[0]);
    expect(ticks[ticks.length - 1]).toBeLessThan(REAL_CRASH_POINT);
  });

  test("the crash point is revealed once the round is over, and betting reopens", async () => {
    await jest.advanceTimersByTimeAsync(BETTING_WINDOW);
    await jest.advanceTimersByTimeAsync(WHOLE_ROUND);

    const results = io.broadcasts.filter((b) => b.event === "crash:result");
    expect(results).toHaveLength(1);
    expect(results[0].payload).toBe(REAL_CRASH_POINT);

    // the state that follows the reveal is the empty one for the next round
    expect(lastState(io)).toEqual({ gameBets: {}, gamePlayers: {}, gameStartTime: null });

    const bob = makeSocket("bob");
    io.connection(bob);
    let reply;
    await bob.handlers["crash:bet"](50, (r) => { reply = r; });
    expect(reply).toEqual({ ok: true });
  });

  test("riding past the bust pays nothing", async () => {
    const bob = makeSocket("bob");
    io.connection(bob);
    await bob.handlers["crash:bet"](100, () => {});

    await jest.advanceTimersByTimeAsync(BETTING_WINDOW);
    await jest.advanceTimersByTimeAsync(WHOLE_ROUND);

    // too late: the round is gone
    await bob.handlers["crash:cashout"](() => {});
    expect(creditUser).not.toHaveBeenCalled();
  });

  test("betting is refused once the round is under way", async () => {
    const bob = makeSocket("bob");
    io.connection(bob);

    await jest.advanceTimersByTimeAsync(BETTING_WINDOW);
    await jest.advanceTimersByTimeAsync(2000);

    let reply;
    await bob.handlers["crash:bet"](100, (r) => { reply = r; });
    expect(reply).toEqual({ error: "Betting is closed for this round" });
  });
});
