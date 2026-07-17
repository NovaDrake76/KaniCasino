process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const { creditUser, TX } = require("../../utils/economy");
const { HOUSE, MINT, SYSTEM_IDS } = require("../../utils/accounts");

let app;
beforeAll(async () => { await setupDb(); app = makeApp(); });
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (walletBalance = 100) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance, weeklyWinnings: 5 });
};

test("the house never appears in topPlayers or ranking", async () => {
  const u = await makeUser(100);
  // give the house a large derived balance and weekly-winnings-shaped activity
  await creditUser(u._id, 100000, 999999, { type: TX.CRASH_BET });

  const top = await request(app).get("/users/topPlayers").set({ Authorization: `Bearer ${tokenFor(u)}` });
  const rank = await request(app).get("/users/ranking").set({ Authorization: `Bearer ${tokenFor(u)}` });

  const rows = [...(top.body || []), ...((rank.body && rank.body.users) || [])];
  const ids = rows.map((p) => String(p._id || p.id));
  expect(ids).toContain(String(u._id)); // the real player is there
  for (const sys of SYSTEM_IDS) expect(ids).not.toContain(sys);
});

test("a player's transaction history never shows a system account's rows", async () => {
  const u = await makeUser(100);
  await creditUser(u._id, 100, 0, { type: TX.BONUS }); // writes a MINT-facing row too

  const res = await request(app)
    .get("/users/transactions")
    .set({ Authorization: `Bearer ${tokenFor(u)}` });

  expect(res.status).toBe(200);
  // every row belongs to the player; the mint/house legs are derived, not their history
  for (const t of res.body.transactions) expect(String(t.userId)).toBe(String(u._id));
  expect(String(HOUSE)).not.toBe(String(u._id));
  expect(String(MINT)).not.toBe(String(u._id));
});
