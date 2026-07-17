const crypto = require("crypto");
const { crashPointFromSeed, GROWTH } = require("../../utils/crashMath");
const { sha256 } = require("../../utils/hashChain");

// jest only lets a mock factory reference out-of-scope vars whose names start with "mock"
let mockCrashSeed = null;

// the chain hands the game its seed; pin it so the round has a known crash point
jest.mock("../../utils/gameChain", () => ({
  consumeNextSeed: jest.fn(async () => ({ seed: mockCrashSeed, chainId: "chain-under-test", index: 0 })),
}));

jest.mock("../../models/Round", () => ({
  create: jest.fn(async (doc) => ({ _id: "round-under-test", ...doc })),
  updateOne: jest.fn(async () => ({})),
}));

jest.mock("../../utils/economy", () => ({
  chargeUser: jest.fn(async (userId) => ({
    _id: userId, username: "player", profilePicture: "", level: 1, fixedItem: null, walletBalance: 500, xp: 0,
  })),
  creditUser: jest.fn(async (userId) => ({ _id: userId, username: "player", walletBalance: 900, xp: 0, level: 1 })),
  TX: { CRASH_BET: "crash_bet", CRASH_CASHOUT: "crash_cashout" },
}));

const crashGame = require("../../games/crash");
const { creditUser } = require("../../utils/economy");

// a seed whose crash point is high enough that a cashout a few seconds in is still in
// the round. found by search so the test does not depend on a hand-picked constant.
function seedWithHighCrash() {
  for (let i = 0; i < 100000; i++) {
    const seed = crypto.createHash("sha256").update(`fixture:${i}`).digest("hex");
    if (crashPointFromSeed(seed) >= 4) return seed;
  }
  throw new Error("no high-crash seed found");
}
const FIXED_SEED = seedWithHighCrash();
const REAL_CRASH_POINT = crashPointFromSeed(FIXED_SEED);
mockCrashSeed = FIXED_SEED;

const BETTING_WINDOW = 12000;
const WHOLE_ROUND = 60000;

const makeIo = () => {
  const broadcasts = [];
  const io = {
    connection: null,
    on: (event, fn) => { if (event === "connection") io.connection = fn; },
    emit: (event, payload) => broadcasts.push({ event, payload: JSON.parse(JSON.stringify(payload ?? null)) }),
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

  beforeEach(async () => {
    jest.useFakeTimers();
    io = makeIo();
    crashGame(io);
    await jest.advanceTimersByTimeAsync(0); // the seed is consumed, then betting opens
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    creditUser.mockClear();
  });

  test("neither the crash point nor the seed is broadcast while the round runs", async () => {
    const alice = makeSocket("alice");
    const bob = makeSocket("bob");
    io.connection(alice);
    io.connection(bob);

    await alice.handlers["crash:bet"](100, () => {});
    await bob.handlers["crash:bet"](100, () => {});

    await jest.advanceTimersByTimeAsync(BETTING_WINDOW); // round starts
    await jest.advanceTimersByTimeAsync(5000); // climbs, still short of the crash

    await alice.handlers["crash:cashout"](() => {});

    expect(REAL_CRASH_POINT).toBeGreaterThanOrEqual(4);
    expect(lastState(io).gamePlayers.bob.payout).toBeNull();

    // the commitment is public, but the crash point and the seed are not
    expect(lastState(io).serverSeedHash).toBe(sha256(FIXED_SEED));
    const leaks = io.broadcasts.filter(
      (b) => b.payload && (b.payload.crashPoint === REAL_CRASH_POINT || b.payload.serverSeed === FIXED_SEED)
    );
    expect(leaks).toEqual([]);
  });

  test("the seed is revealed only when the round ends, and matches its commitment", async () => {
    await jest.advanceTimersByTimeAsync(BETTING_WINDOW);
    await jest.advanceTimersByTimeAsync(WHOLE_ROUND);

    const reveals = io.broadcasts.filter((b) => b.event === "crash:reveal");
    expect(reveals).toHaveLength(1);
    expect(reveals[0].payload.serverSeed).toBe(FIXED_SEED);
    expect(sha256(reveals[0].payload.serverSeed)).toBe(reveals[0].payload.serverSeedHash);
    expect(reveals[0].payload.crashPoint).toBe(REAL_CRASH_POINT);

    const results = io.broadcasts.filter((b) => b.event === "crash:result");
    expect(results[0].payload).toBe(REAL_CRASH_POINT);
  });

  test("a cashout pays stake times the live multiplier", async () => {
    const alice = makeSocket("alice");
    io.connection(alice);
    await alice.handlers["crash:bet"](100, () => {});

    await jest.advanceTimersByTimeAsync(BETTING_WINDOW);
    await jest.advanceTimersByTimeAsync(5000);
    await alice.handlers["crash:cashout"](() => {});

    const expected = Math.exp(5 * GROWTH);
    expect(creditUser).toHaveBeenCalledTimes(1);
    const [userId, payout] = creditUser.mock.calls[0];
    expect(userId).toBe("alice");
    expect(payout).toBeCloseTo(100 * expected, 5);
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
