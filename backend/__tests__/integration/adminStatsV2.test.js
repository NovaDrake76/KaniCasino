process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const { recordTransaction, TX } = require("../../utils/economy");

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
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    walletBalance: 1000,
    ...overrides,
  });
}

const auth = (req, user) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const get = (path, user) => auth(request(app).get(path), user);
const row = (userId, type, direction, amount, meta = {}) =>
  recordTransaction({ userId, type, direction, amount, meta });

const dayString = (date) => date.toISOString().slice(0, 10);

describe("access", () => {
  test("the new stats paths refuse anonymous and non-admin callers", async () => {
    const pleb = await makeUser();
    const paths = [
      "/admin/stats/timeseries",
      "/admin/stats/wins",
      `/admin/stats/users/${pleb._id}`,
    ];
    for (const p of paths) {
      expect((await request(app).get(p)).status).toBe(401);
      expect((await get(p, pleb)).status).toBe(403);
    }
  });
});

describe("GET /admin/stats/timeseries", () => {
  test("buckets wagers, payouts, faucet and players by day", async () => {
    const admin = await makeUser({ isAdmin: true });
    const a = await makeUser();
    const b = await makeUser();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await row(a._id, TX.SLOT_BET, "debit", 100);
    await row(a._id, TX.SLOT_WIN, "credit", 40);
    await row(b._id, TX.BONUS, "credit", 200);
    await Transaction.create({
      userId: a._id, type: TX.CRASH_BET, direction: "debit", amount: 900, createdAt: yesterday,
    });

    const res = await get("/admin/stats/timeseries", admin);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const today = res.body.find((d) => d.day === dayString(new Date()));
    expect(today).toMatchObject({ wagered: 100, paidOut: 40, ggr: 60, faucet: 200, players: 2 });

    const before = res.body.find((d) => d.day === dayString(yesterday));
    expect(before).toMatchObject({ wagered: 900, paidOut: 0, ggr: 900, players: 1 });
    expect(res.body[0].day < res.body[1].day).toBe(true);
  });
});

describe("GET /admin/stats/wins", () => {
  test("returns the biggest single payouts with who hit them", async () => {
    const admin = await makeUser({ isAdmin: true });
    const lucky = await makeUser();
    const other = await makeUser();
    await row(lucky._id, TX.SLOT_WIN, "credit", 5000, { betAmount: 50 });
    await row(other._id, TX.PLINKO_WIN, "credit", 800, { betAmount: 100 });
    await row(other._id, TX.SLOT_BET, "debit", 9999); // a bet is not a win

    const res = await get("/admin/stats/wins", admin);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      username: lucky.username, type: TX.SLOT_WIN, amount: 5000, bet: 50, multiple: 100,
    });
    expect(res.body[1]).toMatchObject({ type: TX.PLINKO_WIN, amount: 800, multiple: 8 });
  });
});

describe("GET /admin/stats/games enrichment", () => {
  test("plinko appears and rows carry reach, biggest win and the designed edge", async () => {
    const admin = await makeUser({ isAdmin: true });
    const a = await makeUser();
    const b = await makeUser();
    await row(a._id, TX.PLINKO_BET, "debit", 100, { risk: "medium" });
    await row(b._id, TX.PLINKO_BET, "debit", 50, { risk: "high" });
    await row(a._id, TX.PLINKO_WIN, "credit", 290, { risk: "medium" });

    const res = await get("/admin/stats/games", admin);
    const plinko = res.body.games.find((g) => g.game === "plinko");
    expect(plinko).toMatchObject({
      plays: 2, wagered: 150, paidOut: 290, net: -140, uniquePlayers: 2, biggestWin: 290,
    });
    expect(plinko.theoRtp).toBeCloseTo(0.9655, 4);
  });

  test("blackjack rows count hands, not the double/split/insurance charges", async () => {
    const admin = await makeUser({ isAdmin: true });
    const a = await makeUser();
    const b = await makeUser();
    // player a: one hand, doubled (two BLACKJACK_BET rows, one hand); won
    await row(a._id, TX.BLACKJACK_BET, "debit", 100, { handId: "BJ1" });
    await row(a._id, TX.BLACKJACK_BET, "debit", 100, { handId: "BJ1", double: true });
    await row(a._id, TX.BLACKJACK_WIN, "credit", 400, { handId: "BJ1", betAmount: 200 });
    // player b: one hand, took insurance, then pushed
    await row(b._id, TX.BLACKJACK_BET, "debit", 100, { handId: "BJ2" });
    await row(b._id, TX.BLACKJACK_BET, "debit", 50, { handId: "BJ2", insurance: true });
    await row(b._id, TX.BLACKJACK_PUSH, "credit", 100, { handId: "BJ2" });

    const res = await get("/admin/stats/games", admin);
    const blackjack = res.body.games.find((g) => g.game === "blackjack");
    expect(blackjack).toMatchObject({
      plays: 2, // two hands, not the four BLACKJACK_BET rows
      wagered: 350, // 100 + 100 + 100 + 50, every KP staked
      paidOut: 500, // win 400 + push 100
      net: -150,
      uniquePlayers: 2,
    });
    expect(blackjack.theoRtp).toBeCloseTo(0.9943, 4);
  });
});

describe("GET /admin/stats/users/:id", () => {
  test("composes identity, totals, per-game lines and the recent ledger", async () => {
    const admin = await makeUser({ isAdmin: true });
    const referrer = await makeUser();
    const player = await makeUser({
      referredBy: referrer._id,
      inventory: [{ _id: new mongoose.Types.ObjectId(), name: "i", image: "i.png", rarity: "1", uniqueId: "uq-1" }],
    });
    await makeUser({ referredBy: player._id });

    await row(player._id, TX.SIGNUP, "credit", 200);
    await row(player._id, TX.BONUS, "credit", 300);
    await row(player._id, TX.SLOT_BET, "debit", 400);
    await row(player._id, TX.SLOT_WIN, "credit", 1000, { betAmount: 400 });
    await row(player._id, TX.CASE_OPEN, "debit", 250, { quantity: 5, caseId: new mongoose.Types.ObjectId() });
    await row(player._id, TX.MARKET_BUY, "debit", 120);
    await row(player._id, TX.ITEM_SELL, "credit", 60);

    const res = await get(`/admin/stats/users/${player._id}`, admin);
    expect(res.status).toBe(200);

    expect(res.body.user).toMatchObject({
      username: player.username,
      referredBy: referrer.username,
      referrals: 1,
      inventoryCount: 1,
    });
    expect(res.body.totals).toMatchObject({
      wagered: 650, won: 1000, net: -350, faucet: 500, marketSpent: 120, itemsSold: 60,
    });
    expect(res.body.totals.biggestWin).toMatchObject({ type: TX.SLOT_WIN, amount: 1000 });

    const byGame = Object.fromEntries(res.body.games.map((g) => [g.game, g]));
    expect(byGame.slots).toMatchObject({ plays: 1, wagered: 400, won: 1000, net: -600 });
    expect(byGame.cases).toMatchObject({ plays: 5, wagered: 250 });
    expect(byGame.crash).toBeUndefined(); // never played

    expect(res.body.recent.length).toBe(7);
    expect(res.body.recent[0].type).toBe(TX.ITEM_SELL);
  });

  test("unknown and malformed ids answer 404", async () => {
    const admin = await makeUser({ isAdmin: true });
    expect((await get(`/admin/stats/users/${new mongoose.Types.ObjectId()}`, admin)).status).toBe(404);
    expect((await get("/admin/stats/users/not-an-id", admin)).status).toBe(404);
  });
});
