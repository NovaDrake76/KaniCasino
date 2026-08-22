process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const Notification = require("../../models/Notification");
const Prediction = require("../../models/Prediction");
const PredictionPosition = require("../../models/PredictionPosition");
const PredictionSettlement = require("../../models/PredictionSettlement");
const { TX } = require("../../utils/economy");
const { trade } = require("../../utils/predictions");
const settlement = require("../../utils/predictionSettlement");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeUser(overrides = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `p-${s}`,
    email: `p-${s}@example.com`,
    password: "x",
    walletBalance: 50000,
    ...overrides,
  });
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

const auth = (req, user) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const balanceOf = async (user) => (await User.findById(user._id)).walletBalance;
const paidTo = async (user, type) => {
  const rows = await Transaction.find({ userId: user._id, type });
  return rows.reduce((s, r) => s + r.amount, 0);
};

describe("resolving a market", () => {
  it("pays a KP a share to the winning side and nothing to the losing one", async () => {
    const winner = await makeUser();
    const loser = await makeUser();
    const market = await makeMarket();

    await trade({ userId: winner._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 100 });
    await trade({ userId: loser._id, predictionId: market._id, outcomeKey: "o2", action: "buy", shares: 100 });
    const spentByWinner = 50000 - (await balanceOf(winner));

    const result = await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o1" });
    expect(result.ok).toBe(true);
    expect(result.paidPositions).toBe(1);
    expect(result.totalPaid).toBe(100);

    expect(await balanceOf(winner)).toBe(50000 - spentByWinner + 100);
    expect(await paidTo(loser, TX.PREDICTION_PAYOUT)).toBe(0);

    const closed = await Prediction.findById(market._id);
    expect(closed.status).toBe("resolved");
    expect(closed.resolvedOutcome).toBe("o1");
  });

  it("settles every position, including the ones it pays nothing", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 10 });
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o2", action: "buy", shares: 10 });

    await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o1" });
    expect(await PredictionPosition.countDocuments({ predictionId: market._id, settled: false })).toBe(0);
  });

  it("tells the winners", async () => {
    const user = await makeUser();
    const market = await makeMarket({ title: "Kanna sweeps" });
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 25 });
    await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o1" });

    const note = await Notification.findOne({ receiverId: user._id });
    expect(note.content).toMatch(/Kanna sweeps/);
    expect(note.content).toMatch(/25 KP/);
  });

  it("pays exactly once however many times it is asked", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 60 });
    const before = await balanceOf(user);

    for (let i = 0; i < 4; i++) {
      const res = await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o1" });
      expect(res.error).toBeUndefined();
    }
    expect(await balanceOf(user)).toBe(before + 60);
    expect(await Transaction.countDocuments({ userId: user._id, type: TX.PREDICTION_PAYOUT })).toBe(1);
  });

  it("refuses to be re-resolved to a different outcome", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 10 });
    await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o1" });

    const res = await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o2" });
    expect(res.error).toMatch(/different outcome/);
  });

  it("refuses an outcome the market does not have", async () => {
    const market = await makeMarket();
    const res = await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o9" });
    expect(res.error).toMatch(/No such outcome/);
  });

  it("stops taking trades the moment it resolves", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o1" });

    const res = await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 1 });
    expect(res.error).toBeTruthy();
  });
});

describe("a settlement that died halfway", () => {
  it("finishes on the sweep, without paying the ones already paid", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const market = await makeMarket();
    await trade({ userId: a._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 40 });
    await trade({ userId: b._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 40 });

    await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o1" });
    const afterA = await balanceOf(a);
    const afterB = await balanceOf(b);

    // put one position back the way a process dying between the two writes would leave it
    await PredictionPosition.updateOne({ userId: b._id }, { $set: { settled: false, payout: 0 } });
    await PredictionSettlement.updateOne({ predictionId: market._id }, { $set: { status: "failed" } });

    const resumed = await settlement.sweepSettlements(null);
    expect(resumed).toBe(1);
    expect(await balanceOf(a)).toBe(afterA);
    expect(await balanceOf(b)).toBe(afterB + 40);
  });

  it("leaves a lease alone while the process holding it is alive", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 10 });

    await Prediction.updateOne({ _id: market._id }, { $set: { status: "resolved", resolvedOutcome: "o1" } });
    await PredictionSettlement.create({ predictionId: market._id, kind: "resolve", outcomeKey: "o1", status: "running", lockedAt: new Date() });

    const res = await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o1" });
    expect(res.error).toMatch(/already being settled/);
    expect(await balanceOf(user)).toBeLessThan(50000);
  });

  it("takes over a lease whose process is not coming back", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 10 });
    const spent = 50000 - (await balanceOf(user));

    await Prediction.updateOne({ _id: market._id }, { $set: { status: "resolved", resolvedOutcome: "o1" } });
    await PredictionSettlement.create({
      predictionId: market._id,
      kind: "resolve",
      outcomeKey: "o1",
      status: "running",
      lockedAt: new Date(Date.now() - settlement.LEASE_STALE_MS - 1000),
    });

    const res = await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o1" });
    expect(res.ok).toBe(true);
    expect(await balanceOf(user)).toBe(50000 - spent + 10);
  });
});

describe("voiding a market", () => {
  it("gives everybody back what they spent, and calls it a refund not a win", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const market = await makeMarket();
    await trade({ userId: a._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 100 });
    await trade({ userId: b._id, predictionId: market._id, outcomeKey: "o2", action: "buy", shares: 250 });

    const res = await settlement.voidMarket({ predictionId: market._id, note: "cancelled" });
    expect(res.ok).toBe(true);
    expect(await balanceOf(a)).toBe(50000);
    expect(await balanceOf(b)).toBe(50000);
    expect(await paidTo(a, TX.PREDICTION_REFUND)).toBeGreaterThan(0);
    expect(await paidTo(a, TX.PREDICTION_PAYOUT)).toBe(0);
    // money coming back is not a week's winnings
    expect((await User.findById(a._id)).weeklyWinnings).toBe(0);
  });

  it("refunds what is left after a partial sale, not the original stake", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 200 });
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "sell", shares: 100 });
    const outOfPocket = 50000 - (await balanceOf(user));

    await settlement.voidMarket({ predictionId: market._id });
    // a void is not a way to get back the vig on trades that already happened
    expect(await balanceOf(user)).toBeLessThanOrEqual(50000);
    expect(await paidTo(user, TX.PREDICTION_REFUND)).toBe(outOfPocket);
  });

  it("refuses to void a market that was already resolved", async () => {
    const market = await makeMarket();
    await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o1" });
    const res = await settlement.voidMarket({ predictionId: market._id });
    expect(res.error).toMatch(/already resolved/);
  });
});

describe("closing", () => {
  it("stops trades without saying what happened", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await settlement.closeMarket(market._id);

    const res = await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 1 });
    expect(res.error).toMatch(/closed/);
    expect((await Prediction.findById(market._id)).status).toBe("closed");
  });

  it("closes anything whose clock has run out and leaves the rest alone", async () => {
    const expired = await makeMarket({ endsAt: new Date(Date.now() - 60000) });
    const live = await makeMarket({ endsAt: new Date(Date.now() + 60000) });
    const forever = await makeMarket();

    expect(await settlement.closeExpired()).toBe(1);
    expect((await Prediction.findById(expired._id)).status).toBe("closed");
    expect((await Prediction.findById(live._id)).status).toBe("open");
    expect((await Prediction.findById(forever._id)).status).toBe("open");
  });

  it("can be reopened, and a resolved market cannot", async () => {
    const market = await makeMarket();
    await settlement.closeMarket(market._id);
    expect((await settlement.reopenMarket(market._id)).ok).toBe(true);

    await settlement.resolveMarket({ predictionId: market._id, outcomeKey: "o1" });
    expect((await settlement.reopenMarket(market._id)).error).toBeTruthy();
  });
});

describe("the admin surface", () => {
  const admin = () => makeUser({ isAdmin: true });

  it("opens a market with a book that adds up", async () => {
    const res = await auth(request(app).post("/admin/predictions"), await admin()).send({
      title: "Will Kanna win the poll",
      description: "Ends on friday",
      category: "Waifu",
      outcomes: ["Kanna", "Rem", "Holo"],
    });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("will-kanna-win-the-poll");
    expect(res.body.outcomes).toHaveLength(3);
    expect(res.body.outcomes.reduce((s, o) => s + o.priceBps, 0)).toBe(10400);
  });

  it("gives a second market with the same title its own url", async () => {
    const who = await admin();
    const body = { title: "Same question", outcomes: ["Yes", "No"] };
    const first = await auth(request(app).post("/admin/predictions"), who).send(body);
    const second = await auth(request(app).post("/admin/predictions"), who).send(body);
    expect(first.body.slug).toBe("same-question");
    expect(second.body.slug).toBe("same-question-2");
  });

  it("refuses a market with fewer than two outcomes", async () => {
    const res = await auth(request(app).post("/admin/predictions"), await admin()).send({
      title: "Only one way this goes",
      outcomes: ["Yes"],
    });
    expect(res.status).toBe(400);
  });

  it("refuses wording nobody should have to read", async () => {
    const res = await auth(request(app).post("/admin/predictions"), await admin()).send({
      title: "Will the n1gger win",
      outcomes: ["Yes", "No"],
    });
    expect(res.status).toBe(400);
  });

  it("keeps the whole thing behind the admin gate", async () => {
    const player = await makeUser();
    const market = await makeMarket();
    const calls = [
      request(app).post("/admin/predictions").send({ title: "x", outcomes: ["a", "b"] }),
      request(app).post(`/admin/predictions/${market._id}/close`),
      request(app).post(`/admin/predictions/${market._id}/resolve`).send({ outcome: "o1" }),
      request(app).post(`/admin/predictions/${market._id}/void`),
      request(app).get("/admin/predictions"),
    ];
    for (const call of calls) expect((await auth(call, player)).status).toBe(403);
  });

  it("resolves over http and pays the winner", async () => {
    const player = await makeUser();
    const market = await makeMarket();
    await trade({ userId: player._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 30 });

    const res = await auth(request(app).post(`/admin/predictions/${market._id}/resolve`), await admin())
      .send({ outcome: "o1", note: "she won" });
    expect(res.status).toBe(200);
    expect(res.body.totalPaid).toBe(30);
    expect((await Prediction.findById(market._id)).resolutionNote).toBe("she won");
  });

  it("lets the price impact be corrected until somebody trades, and not after", async () => {
    const who = await admin();
    const created = await auth(request(app).post("/admin/predictions"), who).send({
      title: "Impact can be fixed",
      outcomes: ["Yes", "No"],
      impactBps: 10,
    });
    const id = created.body._id;

    const fixed = await auth(request(app).put(`/admin/predictions/${id}`), who).send({ impactBps: 2 });
    expect(fixed.status).toBe(200);
    expect(fixed.body.impactBps).toBe(2);

    const player = await makeUser();
    await trade({ userId: player._id, predictionId: id, outcomeKey: "o1", action: "buy", shares: 10 });

    const late = await auth(request(app).put(`/admin/predictions/${id}`), who).send({ impactBps: 5 });
    expect(late.status).toBe(400);
    expect((await Prediction.findById(id)).impactBps).toBe(2);
  });

  it("still takes a wording change after a market has been traded", async () => {
    const who = await admin();
    const player = await makeUser();
    const market = await makeMarket();
    await trade({ userId: player._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 10 });

    const res = await auth(request(app).put(`/admin/predictions/${market._id}`), who)
      .send({ description: "clarified the rule" });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe("clarified the rule");
  });

  it("shows what the house is on the hook for", async () => {
    const player = await makeUser();
    const market = await makeMarket();
    await trade({ userId: player._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 300 });

    const res = await auth(request(app).get("/admin/predictions"), await admin());
    const row = res.body.predictions.find((p) => p.slug === market.slug);
    expect(row.worstCase).toBe(300);
  });
});
