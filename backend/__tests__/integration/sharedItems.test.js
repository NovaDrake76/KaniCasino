process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");
const upgradeItems = require("../../games/upgrade");

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDb();
});
afterAll(teardownDb);

async function makeUser(extra = {}) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", ...extra });
}

// Frieren first dropped from the 2023 case and drops from 2026 too, as the same item
async function twoYears() {
  const y2023 = await Case.create({ title: `2023-${uniqueSuffix()}`, image: "a.webp", price: 200, category: "Anime", items: [] });
  const y2026 = await Case.create({ title: `2026-${uniqueSuffix()}`, image: "b.webp", price: 200, category: "Anime", items: [] });
  const frieren = await Item.create({ name: "Frieren", image: "f.webp", rarity: "2", case: y2023._id, baseValue: 300 });
  const himmel = await Item.create({ name: "Himmel", image: "h.webp", rarity: "1", case: y2023._id, baseValue: 80 });
  const iroha = await Item.create({ name: "Iroha", image: "i.webp", rarity: "3", case: y2026._id, baseValue: 900 });
  const yamada = await Item.create({ name: "Yamada", image: "y.webp", rarity: "1", case: y2026._id, baseValue: 80 });
  await Case.updateOne({ _id: y2023._id }, { $set: { items: [frieren._id, himmel._id] } });
  await Case.updateOne({ _id: y2026._id }, { $set: { items: [frieren._id, iroha._id, yamada._id] } });
  return { y2023, y2026, frieren, himmel, iroha, yamada };
}

const copy = (item, uniqueId) => ({ _id: item._id, rarity: item.rarity, uniqueId, createdAt: new Date() });

describe("an item that drops from more than one case", () => {
  test("can be staked toward a target from any case it drops from", async () => {
    const { y2026, frieren, yamada, iroha } = await twoYears();
    const user = await makeUser({ inventory: [copy(frieren, "f1"), copy(yamada, "y1")] });

    const res = await upgradeItems(String(user._id), ["f1", "y1"], String(iroha._id));

    expect(res.status).toBe(200);
    // a won upgrade reports the case it happened in, not the item's first case
    if (res.success) expect(String(res.item.case)).toBe(String(y2026._id));
  });

  test("still refuses stakes that share no case with the target", async () => {
    const { himmel, iroha } = await twoYears();
    const user = await makeUser({ inventory: [copy(himmel, "h1")] });

    const res = await upgradeItems(String(user._id), ["h1"], String(iroha._id));

    expect(res.status).toBe(400);
    expect(res.message).toBe("All items must be from the same case");
  });

  test("shows up when an inventory is filtered to any case that holds it", async () => {
    const { y2026, frieren, himmel } = await twoYears();
    const user = await makeUser({ inventory: [copy(frieren, "f1"), copy(himmel, "h1")] });

    const res = await request(app).get(`/users/inventory/${user._id}`).query({ caseId: String(y2026._id) });

    expect(res.status).toBe(200);
    const names = res.body.items.map((i) => String(i._id));
    expect(names).toContain(String(frieren._id));
    expect(names).not.toContain(String(himmel._id));
  });

  test("leaves every case that listed it when it is deleted", async () => {
    const { y2023, y2026, frieren } = await twoYears();
    const admin = await makeUser({ isAdmin: true });

    const res = await request(app).delete(`/admin/items/${frieren._id}`).set({ Authorization: `Bearer ${tokenFor(admin)}` });

    expect(res.status).toBe(200);
    for (const c of [y2023, y2026]) {
      const after = await Case.findById(c._id).lean();
      expect(after.items.map(String)).not.toContain(String(frieren._id));
    }
  });
});
