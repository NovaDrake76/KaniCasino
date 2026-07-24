process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const auth = (user) => ["Authorization", `Bearer ${tokenFor(user)}`];

async function makeItem(overrides = {}) {
  return Item.create({
    name: `item-${uniqueSuffix()}`,
    image: "i.png",
    rarity: "1",
    baseValue: 100,
    ...overrides,
  });
}

// n copies of the same catalog item, each its own inventory entry
function copies(item, n, startMs = 0) {
  return Array.from({ length: n }, (_, i) => ({
    uniqueId: `u-${item._id}-${i}-${uniqueSuffix()}`,
    _id: item._id,
    name: item.name,
    image: item.image,
    rarity: item.rarity,
    case: item.case,
    createdAt: new Date(1700000000000 + startMs + i * 1000),
  }));
}

async function makeUserWith(inventory, overrides = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    walletBalance: 0,
    inventory,
    ...overrides,
  });
}

describe("grouped inventory", () => {
  it("stacks duplicates into one row carrying the count", async () => {
    const a = await makeItem();
    const b = await makeItem();
    const user = await makeUserWith([...copies(a, 5), ...copies(b, 2)]);

    const res = await request(app).get(`/users/inventory/${user._id}?grouped=true`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    const byId = Object.fromEntries(res.body.items.map((i) => [String(i._id), i]));
    expect(byId[String(a._id)].quantity).toBe(5);
    expect(byId[String(b._id)].quantity).toBe(2);
  });

  it("ungrouped still returns every copy, so other screens are untouched", async () => {
    const a = await makeItem();
    const user = await makeUserWith(copies(a, 5));

    const res = await request(app).get(`/users/inventory/${user._id}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(5);
  });

  it("pages over distinct items, not copies", async () => {
    const a = await makeItem();
    const user = await makeUserWith(copies(a, 40));

    const res = await request(app).get(`/users/inventory/${user._id}?grouped=true`);

    expect(res.body.totalPages).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(40);
  });

  it("the row's uniqueId is the newest copy", async () => {
    const a = await makeItem();
    const inv = copies(a, 3);
    const newest = inv[inv.length - 1];
    const user = await makeUserWith(inv);

    const res = await request(app).get(`/users/inventory/${user._id}?grouped=true`);

    expect(res.body.items[0].uniqueId).toBe(newest.uniqueId);
  });

  it("only sends the copy ids when asked, and caps them", async () => {
    const a = await makeItem();
    const user = await makeUserWith(copies(a, 150));

    const plain = await request(app).get(`/users/inventory/${user._id}?grouped=true`);
    expect(plain.body.items[0].uniqueIds).toBeUndefined();

    const withIds = await request(app).get(`/users/inventory/${user._id}?grouped=true&withIds=true`);
    expect(withIds.body.items[0].uniqueIds).toHaveLength(100);
  });
});

describe("item copies list", () => {
  it("returns copies newest first, paginated", async () => {
    const a = await makeItem();
    const inv = copies(a, 25);
    const user = await makeUserWith(inv);

    const res = await request(app).get(`/users/inventory/${user._id}/copies/${a._id}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(25);
    expect(res.body.totalPages).toBe(3);
    expect(res.body.copies).toHaveLength(10);
    expect(res.body.copies[0].uniqueId).toBe(inv[inv.length - 1].uniqueId);
  });

  it("404s on a bad id instead of throwing", async () => {
    const user = await makeUserWith([]);
    const res = await request(app).get(`/users/inventory/${user._id}/copies/not-an-id`);
    expect(res.status).toBe(404);
  });
});

describe("selling a stack", () => {
  it("sells every copy when no quantity is given", async () => {
    const a = await makeItem({ baseValue: 100 });
    const user = await makeUserWith(copies(a, 4));

    const res = await request(app)
      .post("/users/inventory/sell")
      .set(...auth(user))
      .send({ itemId: String(a._id) });

    expect(res.status).toBe(200);
    expect(res.body.sold).toBe(4);
    const after = await User.findById(user._id);
    expect(after.inventory).toHaveLength(0);
  });

  it("sells only the asked-for count, newest first", async () => {
    const a = await makeItem({ baseValue: 100 });
    const inv = copies(a, 5);
    const user = await makeUserWith(inv);

    const res = await request(app)
      .post("/users/inventory/sell")
      .set(...auth(user))
      .send({ itemId: String(a._id), quantity: 2 });

    expect(res.body.sold).toBe(2);
    const after = await User.findById(user._id);
    expect(after.inventory).toHaveLength(3);
    // the two newest went, the three oldest stayed
    const left = after.inventory.map((e) => e.uniqueId);
    expect(left).toEqual(inv.slice(0, 3).map((e) => e.uniqueId));
  });

  it("never sells more than is owned", async () => {
    const a = await makeItem({ baseValue: 100 });
    const user = await makeUserWith(copies(a, 2));

    const res = await request(app)
      .post("/users/inventory/sell")
      .set(...auth(user))
      .send({ itemId: String(a._id), quantity: 999 });

    expect(res.body.sold).toBe(2);
  });

  it("leaves other items alone", async () => {
    const a = await makeItem();
    const b = await makeItem();
    const user = await makeUserWith([...copies(a, 3), ...copies(b, 2)]);

    await request(app)
      .post("/users/inventory/sell")
      .set(...auth(user))
      .send({ itemId: String(a._id) });

    const after = await User.findById(user._id);
    expect(after.inventory).toHaveLength(2);
    expect(after.inventory.every((e) => String(e._id) === String(b._id))).toBe(true);
  });
});
