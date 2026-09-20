const { coinResultFromSeed } = require("../../utils/coinMath");
const { sha256 } = require("../../utils/hashChain");

let mockCoinSeed = null;
jest.mock("../../utils/gameChain", () => ({
  consumeNextSeed: jest.fn(async () => ({ seed: mockCoinSeed, chainId: "chain-under-test", index: 0 })),
}));

const created = [];
jest.mock("../../models/Round", () => ({
  create: jest.fn(async (doc) => {
    created.push(doc);
    return { _id: "round-under-test", ...doc };
  }),
  updateOne: jest.fn(async () => ({})),
}));

const credits = [];
jest.mock("../../utils/economy", () => ({
  chargeUser: jest.fn(async (userId) => ({
    _id: userId, username: "player", profilePicture: "", level: 1, fixedItem: null, walletBalance: 500, xp: 0,
  })),
  creditUser: jest.fn(async (userId, payout) => {
    credits.push({ userId, payout });
    return { _id: userId, username: "player", walletBalance: 900, xp: 0, level: 1 };
  }),
  TX: { COINFLIP_BET: "coinflip_bet", COINFLIP_WIN: "coinflip_win" },
}));

const coinFlip = require("../../games/coinFlip");

// a seed that lands purple under version 2, found rather than forged
const purpleSeed = () => {
  for (let i = 0; ; i++) {
    const seed = sha256(`find-purple-${i}`);
    if (coinResultFromSeed(seed, 2) === 2) return seed;
  }
};

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
  const states = io.broadcasts.filter((b) => b.event === "coinFlip:gameState");
  return states[states.length - 1].payload;
};

describe("the purple side, switched on", () => {
  let io;

  beforeEach(async () => {
    process.env.COINFLIP_PURPLE = "1";
    mockCoinSeed = purpleSeed();
    created.length = 0;
    credits.length = 0;
    jest.useFakeTimers();
    io = makeIo();
    coinFlip(io);
    await jest.advanceTimersByTimeAsync(0);
  });

  afterEach(() => {
    delete process.env.COINFLIP_PURPLE;
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("the round is version 2 and the state says purple is open", () => {
    expect(created[0].outcome).toMatchObject({ result: 2, winningSide: "purple", version: 2 });
    expect(lastState(io)).toMatchObject({ purpleOn: true, version: 2, pays: { side: 2, purple: 32 } });
    expect(lastState(io).purple).toEqual({ players: {}, bets: {} });
  });

  test("a purple bet is taken, and pays its multiplier when the coin lands purple", async () => {
    const ann = makeSocket("ann");
    const bob = makeSocket("bob");
    io.connection(ann);
    io.connection(bob);
    let reply;
    await ann.handlers["coinFlip:bet"](100, 2, (r) => { reply = r; });
    expect(reply).toEqual({ ok: true });
    await bob.handlers["coinFlip:bet"](100, 0, () => {});
    expect(lastState(io).purple.bets).toEqual({ ann: 100 });

    await jest.advanceTimersByTimeAsync(14000);
    await jest.advanceTimersByTimeAsync(5000);
    expect(credits).toEqual([{ userId: "ann", payout: 3200 }]);
  });

  test("one bet per round, whichever side it is on", async () => {
    const ann = makeSocket("ann");
    io.connection(ann);
    await ann.handlers["coinFlip:bet"](100, 2, () => {});
    let reply;
    await ann.handlers["coinFlip:bet"](100, 0, (r) => { reply = r; });
    expect(reply.error).toMatch(/already/);
  });
});

describe("the purple side, switched off", () => {
  let io;

  beforeEach(async () => {
    delete process.env.COINFLIP_PURPLE;
    mockCoinSeed = purpleSeed();
    created.length = 0;
    jest.useFakeTimers();
    io = makeIo();
    coinFlip(io);
    await jest.advanceTimersByTimeAsync(0);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("the same seed lands a colour, the round is version 1 and a purple bet is refused", async () => {
    expect(created[0].outcome.version).toBe(1);
    expect([0, 1]).toContain(created[0].outcome.result);
    expect(lastState(io).purpleOn).toBe(false);
    const ann = makeSocket("ann");
    io.connection(ann);
    let reply;
    await ann.handlers["coinFlip:bet"](100, 2, (r) => { reply = r; });
    expect(reply.error).toMatch(/heads or tails/);
  });
});
