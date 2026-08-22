process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");
const { countsFor, holdingsFor, extrasFor } = require("../../utils/inventoryCounts");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const caseId = new mongoose.Types.ObjectId();
const alpha = new mongoose.Types.ObjectId();
const beta = new mongoose.Types.ObjectId();
const gone = new mongoose.Types.ObjectId();

const copies = (id, n, from = caseId) =>
  Array.from({ length: n }, (_, i) => ({
    _id: id,
    uniqueId: `${id}-${i}`,
    name: "x",
    image: "x.png",
    rarity: "1",
    case: from,
  }));

async function makeUser(inventory) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    inventory,
  });
}

describe("tallying an inventory without shipping it", () => {
  it("counts every copy of every item", async () => {
    const user = await makeUser([...copies(alpha, 7), ...copies(beta, 2)]);
    const counts = await countsFor(user._id);

    expect(counts.get(String(alpha))).toBe(7);
    expect(counts.get(String(beta))).toBe(2);
    expect(counts.get(String(gone))).toBeUndefined();
    expect(counts.size).toBe(2);
  });

  it("scopes to the items asked for", async () => {
    const user = await makeUser([...copies(alpha, 3), ...copies(beta, 4)]);
    const counts = await countsFor(user._id, [alpha]);

    expect(counts.get(String(alpha))).toBe(3);
    expect(counts.has(String(beta))).toBe(false);
  });

  it("is empty for an empty inventory and for a user who does not exist", async () => {
    expect((await countsFor((await makeUser([]))._id)).size).toBe(0);
    expect((await countsFor(new mongoose.Types.ObjectId())).size).toBe(0);
  });

  it("hands back the copies themselves, capped", async () => {
    const user = await makeUser(copies(alpha, 9));
    const { countById, uniqueIdsById } = await holdingsFor(user._id, [alpha], 4);

    expect(countById.get(String(alpha))).toBe(9);
    expect(uniqueIdsById.get(String(alpha))).toHaveLength(4);
  });

  it("finds the copies a case no longer lists, with their snapshot", async () => {
    const user = await makeUser([...copies(alpha, 2), ...copies(gone, 3)]);
    const extras = await extrasFor(user._id, caseId, [alpha], 100);

    expect(extras).toHaveLength(1);
    expect(extras[0]._id).toBe(String(gone));
    expect(extras[0].count).toBe(3);
    expect(extras[0].snapshot.name).toBe("x");
    expect(extras[0].uniqueIds).toHaveLength(3);
  });

  it("does not call a copy from another case an extra", async () => {
    const other = new mongoose.Types.ObjectId();
    const user = await makeUser(copies(gone, 3, other));
    expect(await extrasFor(user._id, caseId, [alpha], 100)).toHaveLength(0);
  });
});

describe("the inventory page", () => {
  it("still answers for a visible user and hides a disabled one", async () => {
    await Item.create({ _id: alpha, name: "Alpha", image: "a.png", rarity: "1", baseValue: 10, case: caseId });
    await Case.create({ _id: caseId, name: "C", title: "C", image: "c.png", price: 1, items: [alpha] });

    const user = await makeUser(copies(alpha, 5));
    const res = await request(app).get(`/users/inventory/${user._id}?grouped=true`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(5);

    await User.updateOne({ _id: user._id }, { $set: { disabled: true } });
    expect((await request(app).get(`/users/inventory/${user._id}`)).status).toBe(404);
  });
});
