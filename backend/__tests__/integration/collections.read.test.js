process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");

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
    walletBalance: 0,
    ...overrides,
  });
}

// a case with `rarities` items (one per entry), each with the given baseValue
async function makeCase(rarities, { price = 100 } = {}) {
  const items = [];
  for (const r of rarities) {
    const it = await Item.create({
      name: `item-${uniqueSuffix()}`,
      image: "i.png",
      rarity: String(r.rarity),
      baseValue: r.baseValue,
    });
    it.case = null; // set after the case exists
    items.push(it);
  }
  const c = await Case.create({
    title: `case-${uniqueSuffix()}`,
    image: "c.png",
    price,
    items: items.map((i) => i._id),
  });
  await Item.updateMany({ _id: { $in: items.map((i) => i._id) } }, { case: c._id });
  return { c, items };
}

// give the user `n` copies of a catalog item, tagged to `caseId`
async function give(user, item, n, caseId) {
  const entries = [];
  for (let k = 0; k < n; k++) {
    entries.push({
      _id: item._id,
      name: item.name,
      image: item.image,
      rarity: item.rarity,
      case: caseId,
      uniqueId: `uid-${uniqueSuffix()}`,
      createdAt: new Date(),
    });
  }
  await User.updateOne({ _id: user._id }, { $push: { inventory: { $each: entries } } });
}

describe("GET /collections/summary", () => {
  test("computes completion and duplicate value per case", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([
      { rarity: 1, baseValue: 100 }, // sellValue 75
      { rarity: 3, baseValue: 400 }, // sellValue 300
      { rarity: 5, baseValue: 1000 }, // sellValue 750 (unowned)
    ]);
    await give(u, items[0], 3, c._id); // 2 duplicates -> 150
    await give(u, items[1], 1, c._id); // owned, 0 duplicates

    const res = await request(app).get("/collections/summary").query({ userId: u._id.toString() });
    expect(res.status).toBe(200);
    const col = res.body.collections.find((x) => x.caseId === c._id.toString());
    expect(col.slotsTotal).toBe(3);
    expect(col.slotsOwned).toBe(2);
    expect(col.completionPct).toBeCloseTo(66.7, 1);
    expect(col.duplicatesCount).toBe(2);
    expect(col.duplicatesValue).toBe(150); // 2 * 75
    expect(col.complete).toBe(false);
    expect(res.body.totals.duplicatesValue).toBe(150);
    expect(res.body.totals.slotsOwned).toBe(2);
  });

  test("a fully owned case is marked complete", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([{ rarity: 1, baseValue: 100 }, { rarity: 2, baseValue: 200 }]);
    await give(u, items[0], 1, c._id);
    await give(u, items[1], 1, c._id);
    const res = await request(app).get("/collections/summary").query({ userId: u._id.toString() });
    const col = res.body.collections.find((x) => x.caseId === c._id.toString());
    expect(col.complete).toBe(true);
    expect(col.completionPct).toBe(100);
    expect(res.body.totals.casesComplete).toBe(1);
  });

  test("invalid user id -> 400, unknown user -> 404", async () => {
    expect((await request(app).get("/collections/summary").query({ userId: "nope" })).status).toBe(400);
    const ghost = "651111111111111111111111";
    expect((await request(app).get("/collections/summary").query({ userId: ghost })).status).toBe(404);
  });
});

describe("GET /collections/:caseId", () => {
  test("returns every slot with owned/missing status and duplicate value", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([
      { rarity: 5, baseValue: 1000 },
      { rarity: 1, baseValue: 100 },
    ]);
    await give(u, items[1], 4, c._id); // rarity 1, 3 duplicates -> 225

    const res = await request(app).get(`/collections/${c._id}`).query({ userId: u._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.slotsTotal).toBe(2);
    expect(res.body.slotsOwned).toBe(1);
    // rarest first by default
    expect(res.body.items[0].rarity).toBe("5");
    expect(res.body.items[0].status).toBe("missing");
    const owned = res.body.items.find((i) => i._id === items[1]._id.toString());
    expect(owned.owned).toBe(4);
    expect(owned.duplicates).toBe(3);
    expect(owned.duplicateValue).toBe(225);
    expect(owned.uniqueIds).toHaveLength(4);
  });

  test("filter=missing and filter=duplicates narrow the slots", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([
      { rarity: 1, baseValue: 100 },
      { rarity: 2, baseValue: 200 },
      { rarity: 3, baseValue: 300 },
    ]);
    await give(u, items[0], 2, c._id); // duplicate
    await give(u, items[1], 1, c._id); // owned, no dup

    const missing = await request(app).get(`/collections/${c._id}`).query({ userId: u._id.toString(), filter: "missing" });
    expect(missing.body.items.map((i) => i._id)).toEqual([items[2]._id.toString()]);

    const dups = await request(app).get(`/collections/${c._id}`).query({ userId: u._id.toString(), filter: "duplicates" });
    expect(dups.body.items.map((i) => i._id)).toEqual([items[0]._id.toString()]);
  });

  test("owned item removed from the case shows up as a read-only extra", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([
      { rarity: 1, baseValue: 100 },
      { rarity: 2, baseValue: 200 },
    ]);
    const removed = items[1];
    await give(u, removed, 3, c._id); // 3 copies, tagged to this case
    // admin removes it from the case's item list
    await Case.updateOne({ _id: c._id }, { $pull: { items: removed._id } });

    const res = await request(app).get(`/collections/${c._id}`).query({ userId: u._id.toString() });
    expect(res.body.slotsTotal).toBe(1); // only the rarity-1 slot remains
    expect(res.body.items.some((i) => i._id === removed._id.toString())).toBe(false);
    expect(res.body.extras).toHaveLength(1);
    expect(res.body.extras[0]._id).toBe(removed._id.toString());
    expect(res.body.extras[0].inCase).toBe(false);
    expect(res.body.extras[0].owned).toBe(3);
  });

  test("bad case id -> 404, invalid user -> 400", async () => {
    const u = await makeUser();
    const { c } = await makeCase([{ rarity: 1, baseValue: 100 }]);
    expect((await request(app).get(`/collections/notanid`).query({ userId: u._id.toString() })).status).toBe(404);
    expect((await request(app).get(`/collections/${c._id}`).query({ userId: "nope" })).status).toBe(400);
  });

  test("second page respects the 18-per-page size", async () => {
    const u = await makeUser();
    const rarities = Array.from({ length: 20 }, () => ({ rarity: 1, baseValue: 100 }));
    const { c } = await makeCase(rarities);
    const p1 = await request(app).get(`/collections/${c._id}`).query({ userId: u._id.toString(), page: 1 });
    const p2 = await request(app).get(`/collections/${c._id}`).query({ userId: u._id.toString(), page: 2 });
    expect(p1.body.items).toHaveLength(18);
    expect(p2.body.items).toHaveLength(2);
    expect(p1.body.totalPages).toBe(2);
  });
});
