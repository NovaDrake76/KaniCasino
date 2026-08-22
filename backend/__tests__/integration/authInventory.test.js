process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const { isAuthenticated } = require("../../middleware/authMiddleware");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const itemId = new mongoose.Types.ObjectId();

const stack = (n) =>
  Array.from({ length: n }, (_, i) => ({
    _id: itemId,
    uniqueId: `u-${i}`,
    name: "Keine",
    image: "keine.png",
    rarity: "1",
  }));

async function makeUser(overrides = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    walletBalance: 500,
    ...overrides,
  });
}

// the middleware runs on every authenticated request, so anything it carries is paid for
// on every bet, every case open and every page load
describe("what isAuthenticated loads", () => {
  it("leaves the inventory behind", async () => {
    const user = await makeUser({ inventory: stack(30) });
    const req = { header: () => `Bearer ${tokenFor(user)}` };
    let passed = false;

    await isAuthenticated(req, {}, () => {
      passed = true;
    });

    expect(passed).toBe(true);
    expect(req.user.inventory).toBeUndefined();
  });

  it("still carries everything a route reads off req.user", async () => {
    const fanRank = { name: "Keine", image: "k.png", rarity: "1", count: 9, rank: 1, fans: 3 };
    const user = await makeUser({
      inventory: stack(12),
      fanRank,
      selectedBadge: "topFan",
      cardStyle: "agit",
      walletBalance: 1234,
      level: 7,
    });
    const req = { header: () => `Bearer ${tokenFor(user)}` };
    await isAuthenticated(req, {}, () => {});

    expect(req.user.username).toBe(user.username);
    expect(req.user.walletBalance).toBe(1234);
    expect(req.user.level).toBe(7);
    expect(req.user.fanRank.name).toBe("Keine");
    expect(req.user.selectedBadge).toBe("topFan");
    expect(req.user.password).toBeUndefined();
  });

  it("keeps rejecting a revoked token and a disabled account", async () => {
    const revoked = await makeUser({ inventory: stack(5), tokenVersion: 2 });
    const token = tokenFor(revoked);
    const stale = await request(app).get("/users/me").set("Authorization", `Bearer ${token}`);
    expect(stale.status).toBe(401);

    const off = await makeUser({ inventory: stack(5), disabled: true });
    const blocked = await request(app).get("/users/me").set("Authorization", `Bearer ${tokenFor(off)}`);
    expect(blocked.status).toBe(403);
  });
});

describe("routes that do need an inventory", () => {
  it("pins an item, because that route reads its own copy", async () => {
    await Item.create({ _id: itemId, name: "Keine", image: "keine.png", rarity: "1" });
    const user = await makeUser({ inventory: stack(3) });
    const res = await request(app)
      .put("/users/fixedItem")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ item: itemId.toString() });

    expect(res.status).toBe(200);
    const saved = await User.findById(user._id).select("fixedItem").lean();
    expect(saved.fixedItem.name).toBe("Keine");
  });

  it("serves the profile with the inventory count intact", async () => {
    const user = await makeUser({ inventory: stack(4) });
    const res = await request(app).get("/users/me").set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe(user.username);
    const stored = await User.findById(user._id).select("inventory").lean();
    expect(stored.inventory).toHaveLength(4);
  });
});
