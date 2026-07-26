process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Round = require("../../models/Round");
const { pruneEmptyRounds } = require("../../utils/roundPrune");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

async function makeRound(overrides) {
  const r = await Round.create({ game: "crash", status: "settled", bets: [], ...overrides });
  if (overrides.createdAt) {
    await Round.updateOne({ _id: r._id }, { $set: { createdAt: overrides.createdAt } });
  }
  return r;
}

describe("pruning rounds nobody bet on", () => {
  it("removes old empty rounds", async () => {
    await makeRound({ createdAt: hoursAgo(48) });
    await makeRound({ createdAt: hoursAgo(30), game: "coinflip" });

    expect(await pruneEmptyRounds()).toBe(2);
    expect(await Round.countDocuments()).toBe(0);
  });

  it("keeps any round that took a bet, however old", async () => {
    await makeRound({
      createdAt: hoursAgo(24 * 90),
      bets: [{ userId: "507f1f77bcf86cd799439011", username: "p", amount: 10, payout: 0 }],
    });

    expect(await pruneEmptyRounds()).toBe(0);
    expect(await Round.countDocuments()).toBe(1);
  });

  it("keeps recent empty rounds so the history strip stays full", async () => {
    await makeRound({ createdAt: hoursAgo(2) });
    expect(await pruneEmptyRounds()).toBe(0);
    expect(await Round.countDocuments()).toBe(1);
  });

  it("never touches a round still in flight", async () => {
    await makeRound({ createdAt: hoursAgo(48), status: "betting" });
    await makeRound({ createdAt: hoursAgo(48), status: "running" });

    expect(await pruneEmptyRounds()).toBe(0);
    expect(await Round.countDocuments()).toBe(2);
  });
});

describe("inventory entries carry only what identifies the copy", () => {
  async function seed() {
    const item = await Item.create({
      name: `Nemuno-${uniqueSuffix()}`,
      image: "https://example.com/n.png",
      rarity: "3",
      baseValue: 400,
    });
    const s = uniqueSuffix();
    const user = await User.create({
      username: `user-${s}`,
      email: `user-${s}@example.com`,
      password: "x",
      inventory: [{ _id: item._id, rarity: "3", uniqueId: `u-${s}`, createdAt: new Date() }],
    });
    return { item, user };
  }

  it("hydrates name and image from the catalog on read", async () => {
    const { item, user } = await seed();

    const res = await request(app).get(`/users/inventory/${user._id}?grouped=true`);

    expect(res.status).toBe(200);
    const row = res.body.items[0];
    expect(row.name).toBe(item.name);
    expect(row.image).toBe(item.image);
    expect(row.sellValue).toBeGreaterThan(0);
  });

  it("still finds an item by name, which now lives only on the catalog", async () => {
    const { item, user } = await seed();

    const hit = await request(app).get(`/users/inventory/${user._id}?grouped=true&name=${item.name}`);
    expect(hit.body.items).toHaveLength(1);

    const miss = await request(app).get(`/users/inventory/${user._id}?grouped=true&name=nothinglikethis`);
    expect(miss.body.items).toHaveLength(0);
  });

  it("still filters by case through the catalog", async () => {
    const caseId = "507f1f77bcf86cd799439099";
    const item = await Item.create({
      name: `Cased-${uniqueSuffix()}`,
      image: "c.png",
      rarity: "1",
      baseValue: 10,
      case: caseId,
    });
    const s = uniqueSuffix();
    const user = await User.create({
      username: `user-${s}`,
      email: `user-${s}@example.com`,
      password: "x",
      inventory: [{ _id: item._id, rarity: "1", uniqueId: `u-${s}`, createdAt: new Date() }],
    });

    const hit = await request(app).get(`/users/inventory/${user._id}?grouped=true&caseId=${caseId}`);
    expect(hit.body.items).toHaveLength(1);

    const miss = await request(app).get(
      `/users/inventory/${user._id}?grouped=true&caseId=507f1f77bcf86cd799439000`
    );
    expect(miss.body.items).toHaveLength(0);
  });

  it("still sorts by rarity, which stays on the entry", async () => {
    const s = uniqueSuffix();
    const common = await Item.create({ name: `c-${s}`, image: "c.png", rarity: "1", baseValue: 10 });
    const rare = await Item.create({ name: `r-${s}`, image: "r.png", rarity: "5", baseValue: 900 });
    const user = await User.create({
      username: `user-${s}`,
      email: `user-${s}@example.com`,
      password: "x",
      inventory: [
        { _id: common._id, rarity: "1", uniqueId: `a-${s}`, createdAt: new Date() },
        { _id: rare._id, rarity: "5", uniqueId: `b-${s}`, createdAt: new Date() },
      ],
    });

    const res = await request(app).get(`/users/inventory/${user._id}?grouped=true&sortBy=mostRare`);
    expect(res.body.items[0].name).toBe(rare.name);
  });
});
