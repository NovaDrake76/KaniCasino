process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");

let app;
beforeAll(async () => { await setupDb(); app = makeApp(); });
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (fields = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance: 0, ...fields });
};

test("an admin balance set records the delta as a ledger row", async () => {
  const admin = await makeUser({ isAdmin: true });
  const target = await makeUser({ walletBalance: 100 });

  const res = await request(app)
    .put(`/admin/users/${target._id}/wallet`)
    .set({ Authorization: `Bearer ${tokenFor(admin)}` })
    .send({ walletBalance: 350 });

  expect(res.status).toBe(200);
  expect((await User.findById(target._id)).walletBalance).toBe(350);

  const row = await Transaction.findOne({ userId: target._id, type: TX.ADMIN_ADJUST });
  expect(row.direction).toBe("credit");
  expect(row.amount).toBe(250);
  expect(row.meta.previous).toBe(100);
});

test("setting the same balance records nothing", async () => {
  const admin = await makeUser({ isAdmin: true });
  const target = await makeUser({ walletBalance: 200 });

  await request(app)
    .put(`/admin/users/${target._id}/wallet`)
    .set({ Authorization: `Bearer ${tokenFor(admin)}` })
    .send({ walletBalance: 200 });

  expect(await Transaction.countDocuments({ userId: target._id })).toBe(0);
});

test("a non-admin cannot set a balance", async () => {
  const notAdmin = await makeUser({});
  const target = await makeUser({ walletBalance: 100 });

  const res = await request(app)
    .put(`/admin/users/${target._id}/wallet`)
    .set({ Authorization: `Bearer ${tokenFor(notAdmin)}` })
    .send({ walletBalance: 999999 });

  expect(res.status).toBeGreaterThanOrEqual(401);
  expect((await User.findById(target._id)).walletBalance).toBe(100);
});
