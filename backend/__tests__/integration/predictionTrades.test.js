process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const Prediction = require("../../models/Prediction");
const PredictionPosition = require("../../models/PredictionPosition");
const PredictionTrade = require("../../models/PredictionTrade");
const PredictionPricepoint = require("../../models/PredictionPricepoint");
const { TX } = require("../../utils/economy");
const { HOUSE } = require("../../utils/accounts");
const { trade } = require("../../utils/predictions");
const { targetSum } = require("../../utils/predictionMath");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

async function makeUser(walletBalance = 10000) {
  const s = uniqueSuffix();
  return User.create({ username: `p-${s}`, email: `p-${s}@example.com`, password: "x", walletBalance });
}

async function makeMarket(overrides = {}) {
  const s = uniqueSuffix();
  return Prediction.create({
    slug: `m-${s}`,
    title: "Does she win",
    outcomes: Prediction.openBook(["Yes", "No"]),
    ...overrides,
  });
}

const book = (p) => p.outcomes.map((o) => o.priceBps);
const totalOf = (p) => book(p).reduce((s, n) => s + n, 0);

describe("a fill", () => {
  it("charges the wallet, opens a position and moves the book", async () => {
    const user = await makeUser();
    const market = await makeMarket();

    const res = await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 100 });
    expect(res.error).toBeUndefined();
    expect(res.spent).toBe(57);

    const after = await User.findById(user._id);
    expect(after.walletBalance).toBe(10000 - 57);

    const pos = await PredictionPosition.findOne({ userId: user._id });
    expect(pos.shares).toBe(100);
    expect(pos.spent).toBe(57);
    expect(pos.avgPriceBps).toBe(5700);

    const moved = await Prediction.findById(market._id);
    expect(moved.outcomes[0].priceBps).toBe(6200);
    expect(moved.outcomes[0].shares).toBe(100);
    expect(moved.volume).toBe(57);
    expect(moved.traders).toBe(1);
    expect(totalOf(moved)).toBe(targetSum());
  });

  it("writes a ledger row against the house, not against another player", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 50 });

    const row = await Transaction.findOne({ userId: user._id, type: TX.PREDICTION_BUY });
    expect(row.direction).toBe("debit");
    expect(String(row.counterparty)).toBe(String(HOUSE));
    expect(row.meta.outcome).toBe("o1");
    expect(row.meta.shares).toBe(50);
  });

  it("records the trade and a price point for every outcome", async () => {
    const user = await makeUser();
    const market = await makeMarket({ outcomes: Prediction.openBook(["A", "B", "C"]) });
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o2", action: "buy", shares: 30 });

    const trades = await PredictionTrade.find({ predictionId: market._id });
    expect(trades).toHaveLength(1);
    expect(trades[0].action).toBe("buy");
    expect(trades[0].priceBeforeBps).toBeLessThan(trades[0].priceAfterBps);

    const points = await PredictionPricepoint.find({ predictionId: market._id });
    expect(points).toHaveLength(3);
  });

  it("counts a returning trader once", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 10 });
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 10 });

    const after = await Prediction.findById(market._id);
    expect(after.traders).toBe(1);
    const pos = await PredictionPosition.findOne({ userId: user._id });
    expect(pos.shares).toBe(20);
  });
});

describe("what a fill refuses", () => {
  it("turns away a buy the wallet cannot cover, and leaves the book where it was", async () => {
    const user = await makeUser(5);
    const market = await makeMarket();
    const before = book(await Prediction.findById(market._id));

    const res = await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 500 });
    expect(res.error).toBe("Not enough KP");

    const after = await Prediction.findById(market._id);
    expect(book(after)).toEqual(before);
    expect(after.outcomes[0].shares).toBe(0);
    expect(after.volume).toBe(0);
    expect((await User.findById(user._id)).walletBalance).toBe(5);
    expect(await PredictionTrade.countDocuments()).toBe(0);
  });

  it("refuses to take on more than the exposure cap", async () => {
    const user = await makeUser(100000);
    const market = await makeMarket({ exposureCap: 200 });

    const ok = await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 200 });
    expect(ok.error).toBeUndefined();

    const res = await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 1 });
    expect(res.error).toMatch(/all it can/);
    expect((await Prediction.findById(market._id)).outcomes[0].shares).toBe(200);
  });

  it("refuses a closed market and one whose clock has run out", async () => {
    const user = await makeUser();
    const closed = await makeMarket({ status: "closed" });
    const expired = await makeMarket({ endsAt: new Date(Date.now() - 1000) });

    const a = await trade({ userId: user._id, predictionId: closed._id, outcomeKey: "o1", action: "buy", shares: 1 });
    const b = await trade({ userId: user._id, predictionId: expired._id, outcomeKey: "o1", action: "buy", shares: 1 });
    expect(a.error).toBeTruthy();
    expect(b.error).toBeTruthy();
  });

  it("turns away nonsense before it touches anything", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    const bad = [
      { outcomeKey: "nope", action: "buy", shares: 1 },
      { outcomeKey: "o1", action: "hedge", shares: 1 },
      { outcomeKey: "o1", action: "buy", shares: 0 },
      { outcomeKey: "o1", action: "buy", shares: 2.5 },
      { outcomeKey: "o1", action: "buy", shares: -5 },
      { outcomeKey: "o1", action: "buy", shares: 99999999 },
    ];
    for (const input of bad) {
      const res = await trade({ userId: user._id, predictionId: market._id, ...input });
      expect(res.error).toBeTruthy();
    }
    expect((await User.findById(user._id)).walletBalance).toBe(10000);
  });
});

describe("selling", () => {
  it("pays out, shrinks the position and walks the price back", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 100 });
    const spent = 10000 - (await User.findById(user._id)).walletBalance;

    const res = await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "sell", shares: 100 });
    expect(res.error).toBeUndefined();
    // a round trip comes back to the same price and never returns more than it cost
    const after = await Prediction.findById(market._id);
    expect(after.outcomes[0].priceBps).toBe(5200);
    expect(after.outcomes[0].shares).toBe(0);
    expect(res.received).toBeLessThanOrEqual(spent);

    const pos = await PredictionPosition.findOne({ userId: user._id });
    expect(pos.shares).toBe(0);
    expect(pos.costBps).toBe(0);
  });

  it("refuses to sell shares nobody holds", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 10 });

    const res = await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "sell", shares: 11 });
    expect(res.error).toMatch(/do not hold/);
    expect((await Prediction.findById(market._id)).outcomes[0].shares).toBe(10);
  });

  it("lets only one of two simultaneous sells of the whole position through", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 200 });

    const sell = () => trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "sell", shares: 200 });
    const results = await Promise.all([sell(), sell()]);
    const filled = results.filter((r) => !r.error);
    expect(filled).toHaveLength(1);

    const pos = await PredictionPosition.findOne({ userId: user._id });
    expect(pos.shares).toBe(0);
    const after = await Prediction.findById(market._id);
    expect(after.outcomes[0].shares).toBe(0);
    expect(totalOf(after)).toBe(targetSum());
  });
});

describe("a busy market", () => {
  it("fills concurrent buys one after another instead of on top of each other", async () => {
    const market = await makeMarket();
    const users = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser(), makeUser()]);

    const results = await Promise.all(
      users.map((u) => trade({ userId: u._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 40 }))
    );
    expect(results.filter((r) => r.error)).toHaveLength(0);

    const after = await Prediction.findById(market._id);
    // five fills of forty, each priced off the one before, so the price is where a single
    // two hundred share fill would have left it
    expect(after.outcomes[0].shares).toBe(200);
    expect(after.outcomes[0].priceBps).toBe(5200 + 200 * 10);
    expect(totalOf(after)).toBe(targetSum());

    const spent = results.reduce((s, r) => s + r.spent, 0);
    expect(after.volume).toBe(spent);
    const charged = await Transaction.aggregate([
      { $match: { type: TX.PREDICTION_BUY } },
      { $group: { _id: null, n: { $sum: "$amount" } } },
    ]);
    expect(charged[0].n).toBe(spent);
  });

  it("never lets the house pay out more than it took in, however the market ends", async () => {
    const market = await makeMarket({ outcomes: Prediction.openBook(["A", "B", "C"]), exposureCap: 100000 });
    const users = await Promise.all([makeUser(200000), makeUser(200000), makeUser(200000)]);

    for (let round = 0; round < 12; round++) {
      const user = users[round % 3];
      const key = `o${(round % 3) + 1}`;
      await trade({ userId: user._id, predictionId: market._id, outcomeKey: key, action: "buy", shares: 20 + round });
      if (round % 4 === 3) {
        await trade({ userId: user._id, predictionId: market._id, outcomeKey: key, action: "sell", shares: 10 });
      }
    }

    const rows = await Transaction.aggregate([
      { $match: { type: { $in: [TX.PREDICTION_BUY, TX.PREDICTION_SELL] } } },
      { $group: { _id: "$type", n: { $sum: "$amount" } } },
    ]);
    const by = Object.fromEntries(rows.map((r) => [r._id, r.n]));
    const taken = (by[TX.PREDICTION_BUY] || 0) - (by[TX.PREDICTION_SELL] || 0);

    const after = await Prediction.findById(market._id);
    const worstPayout = Math.max(...after.outcomes.map((o) => o.shares));
    expect(taken).toBeGreaterThanOrEqual(worstPayout);
    expect(totalOf(after)).toBe(targetSum());
  });
});
