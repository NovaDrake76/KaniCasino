process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Case = require("../../models/Case");
const Transaction = require("../../models/Transaction");
const { recordTransaction, TX } = require("../../utils/economy");
const { HOUSE } = require("../../utils/accounts");

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

// recordTransaction fills the counterparty from the type, like the live money paths do
const row = (userId, type, direction, amount, meta = {}) =>
  recordTransaction({ userId, type, direction, amount, meta });

describe("access", () => {
  const PATHS = ["/admin/stats/overview", "/admin/stats/games", "/admin/stats/cases", "/admin/stats/users"];

  test("anonymous and non-admin callers are refused", async () => {
    const pleb = await makeUser();
    for (const p of PATHS) {
      expect((await request(app).get(p)).status).toBe(401);
      expect((await get(p, pleb)).status).toBe(403);
    }
  });

  test("/users/me tells the caller their own admin flag", async () => {
    const admin = await makeUser({ isAdmin: true });
    const pleb = await makeUser();
    expect((await get("/users/me", admin)).body.isAdmin).toBe(true);
    expect((await get("/users/me", pleb)).body.isAdmin).toBe(false);
  });
});

describe("GET /admin/stats/overview", () => {
  test("counts users and derives the economy from the ledger", async () => {
    const admin = await makeUser({ isAdmin: true });
    const a = await makeUser();
    await makeUser(); // registered but never played
    await row(a._id, TX.BONUS, "credit", 500);
    await row(a._id, TX.CRASH_BET, "debit", 300);
    await row(a._id, TX.CRASH_CASHOUT, "credit", 100);

    const res = await get("/admin/stats/overview", admin);
    expect(res.status).toBe(200);
    expect(res.body.users.total).toBe(3);
    expect(res.body.users.active).toBe(1); // only a transacted
    expect(res.body.economy.supply).toBe(500); // the bonus minted 500
    expect(res.body.economy.houseBalance).toBe(200); // 300 staked, 100 paid back
  });
});

describe("GET /admin/stats/games", () => {
  test("nets each game and splits house lines from issuance", async () => {
    const admin = await makeUser({ isAdmin: true });
    const u = await makeUser();
    await row(u._id, TX.CRASH_BET, "debit", 1000);
    await row(u._id, TX.CRASH_CASHOUT, "credit", 400);
    await row(u._id, TX.SLOT_BET, "debit", 200);
    await row(u._id, TX.SLOT_WIN, "credit", 300);
    await row(u._id, TX.CASE_OPEN, "debit", 500, { quantity: 5, caseId: new mongoose.Types.ObjectId() });
    // the live fee writer books the fee with HOUSE as the row's owner, so mirror it
    await recordTransaction({ userId: HOUSE, type: TX.MARKET_FEE, direction: "credit", amount: 25, counterparty: null });
    await row(u._id, TX.ITEM_SELL, "credit", 80);
    await row(u._id, TX.BONUS, "credit", 900);

    const res = await get("/admin/stats/games", admin);
    expect(res.status).toBe(200);

    const byGame = Object.fromEntries(res.body.games.map((g) => [g.game, g]));
    expect(byGame.crash).toMatchObject({ plays: 1, wagered: 1000, paidOut: 400, net: 600 });
    expect(byGame.slots).toMatchObject({ plays: 1, wagered: 200, paidOut: 300, net: -100 }); // a deficit
    expect(byGame.cases).toMatchObject({ plays: 5, wagered: 500, net: 500 }); // quantity, not row count
    expect(res.body.games[0].game).toBe("crash"); // most profitable first
    expect(res.body.games[res.body.games.length - 1].game).toBe("slots"); // biggest deficit last

    const lines = Object.fromEntries(res.body.houseLines.map((l) => [l.type, l.net]));
    expect(lines.market_fee).toBe(25);
    expect(lines.item_sell).toBe(-80); // the house buying items back
    const issued = Object.fromEntries(res.body.issuance.map((l) => [l.type, l.issued]));
    expect(issued.bonus).toBe(900);
  });
});

describe("GET /admin/stats/cases", () => {
  test("ranks cases by opens, summing quantities, tolerating deleted cases", async () => {
    const admin = await makeUser({ isAdmin: true });
    const u = await makeUser();
    const hot = await Case.create({ title: "Hot Case", image: "hot.png", price: 100, items: [] });
    const goneId = new mongoose.Types.ObjectId();

    await row(u._id, TX.CASE_OPEN, "debit", 300, { caseId: hot._id, caseTitle: "Hot Case", quantity: 3 });
    await row(u._id, TX.CASE_OPEN, "debit", 200, { caseId: hot._id, caseTitle: "Hot Case", quantity: 2 });
    await row(u._id, TX.CASE_OPEN, "debit", 50, { caseId: goneId, caseTitle: "Old Case", quantity: 1 });

    const res = await get("/admin/stats/cases", admin);
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ title: "Hot Case", opens: 5, spent: 500, image: "hot.png", price: 100 });
    expect(res.body[1]).toMatchObject({ title: "Old Case", opens: 1, spent: 50, image: null, price: null });
  });
});

describe("GET /admin/stats/users", () => {
  test("paginates, searches safely and sums each user's wagers", async () => {
    const admin = await makeUser({ isAdmin: true });
    const whale = await makeUser({ username: `whale-${uniqueSuffix()}` });
    for (let i = 0; i < 20; i++) await makeUser();
    await row(whale._id, TX.SLOT_BET, "debit", 700);
    await row(whale._id, TX.SLOT_WIN, "credit", 900); // a win is not a wager

    const page2 = await get("/admin/stats/users?page=2", admin);
    expect(page2.status).toBe(200);
    expect(page2.body.total).toBe(22);
    expect(page2.body.pages).toBe(2);
    expect(page2.body.users).toHaveLength(2);

    const found = await get("/admin/stats/users?search=whale", admin);
    expect(found.body.users).toHaveLength(1);
    expect(found.body.users[0].wagered).toBe(700);
    expect(found.body.users[0].lastActive).not.toBeNull();
    expect(found.body.users[0].joined).toBeTruthy();

    // a regex metacharacter is treated as text, not as a pattern
    expect((await get("/admin/stats/users?search=.*", admin)).body.users).toHaveLength(0);
  });
});

describe("time windows", () => {
  test("?days= excludes older activity", async () => {
    const admin = await makeUser({ isAdmin: true });
    const u = await makeUser();
    await row(u._id, TX.CRASH_BET, "debit", 100);
    await Transaction.create({
      userId: u._id, type: TX.CRASH_BET, direction: "debit", amount: 900,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });

    const all = await get("/admin/stats/games", admin);
    const week = await get("/admin/stats/games?days=7", admin);
    const crashAll = all.body.games.find((g) => g.game === "crash");
    const crashWeek = week.body.games.find((g) => g.game === "crash");
    expect(crashAll.wagered).toBe(1000);
    expect(crashWeek.wagered).toBe(100);
  });
});
