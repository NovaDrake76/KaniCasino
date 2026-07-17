const crypto = require("crypto");
const { coinResultFromSeed } = require("../../utils/coinMath");
const { sha256 } = require("../../utils/hashChain");

let mockCoinSeed = null;
jest.mock("../../utils/gameChain", () => ({
  consumeNextSeed: jest.fn(async () => ({ seed: mockCoinSeed, chainId: "chain-under-test", index: 0 })),
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
  TX: { COINFLIP_BET: "coinflip_bet", COINFLIP_WIN: "coinflip_win" },
}));

const coinFlip = require("../../games/coinFlip");
const FIXED_SEED = sha256("coinflip-fixture");
const RESULT = coinResultFromSeed(FIXED_SEED);
mockCoinSeed = FIXED_SEED;

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

describe("coin flip secrecy", () => {
  let io;

  beforeEach(async () => {
    jest.useFakeTimers();
    io = makeIo();
    coinFlip(io);
    await jest.advanceTimersByTimeAsync(0); // the seed is consumed, then betting opens
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("neither the result nor the seed is broadcast during betting", async () => {
    const bob = makeSocket("bob");
    io.connection(bob);
    await bob.handlers["coinFlip:bet"](100, 0, () => {});

    const states = io.broadcasts.filter((b) => b.event === "coinFlip:gameState");
    const last = states[states.length - 1].payload;
    // the commitment is public; the result and the seed are not
    expect(last.serverSeedHash).toBe(sha256(FIXED_SEED));
    const leaks = io.broadcasts.filter(
      (b) => b.payload && (b.payload.result === RESULT || b.payload.serverSeed === FIXED_SEED)
    );
    expect(leaks).toEqual([]);
  });

  test("the seed is revealed only when the flip resolves, and matches its commitment", async () => {
    await jest.advanceTimersByTimeAsync(14000); // betting closes, the flip happens
    await jest.advanceTimersByTimeAsync(5000); // reveal + payout

    const reveals = io.broadcasts.filter((b) => b.event === "coinFlip:reveal");
    expect(reveals).toHaveLength(1);
    expect(reveals[0].payload.serverSeed).toBe(FIXED_SEED);
    expect(sha256(reveals[0].payload.serverSeed)).toBe(reveals[0].payload.serverSeedHash);
    expect(reveals[0].payload.result).toBe(RESULT);

    const results = io.broadcasts.filter((b) => b.event === "coinFlip:result");
    expect(results[0].payload).toBe(RESULT);
  });
});
