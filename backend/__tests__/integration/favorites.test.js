process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

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

const auth = (user) => ["Authorization", `Bearer ${tokenFor(user)}`];

async function makeUser(overrides = {}) {
  const s = uniqueSuffix();
  return User.create({ username: `user-${s}`, email: `user-${s}@example.com`, password: "x", walletBalance: 0, ...overrides });
}

const makeItem = () => Item.create({ name: `item-${uniqueSuffix()}`, image: "i.png", rarity: "2", baseValue: 100 });

async function give(user, item, n) {
  const ids = Array.from({ length: n }, () => `uid-${uniqueSuffix()}`);
  await User.updateOne(
    { _id: user._id },
    { $push: { inventory: { $each: ids.map((uniqueId, k) => ({ _id: item._id, rarity: item.rarity, uniqueId, createdAt: new Date(1_700_000_000_000 + k * 1000) })) } } }
  );
  return ids;
}

const favorite = (user, item, on = true) =>
  request(app).put(`/users/favorites/${item._id}`).set(...auth(user)).send({ favorite: on });
const held = async (user) => (await User.findById(user._id, { inventory: 1 }).lean()).inventory.map((e) => e.uniqueId);

describe("marking a favorite", () => {
  it("marks and unmarks a whole item the player holds, and /me carries the list", async () => {
    const user = await makeUser();
    const item = await makeItem();
    await give(user, item, 2);

    const on = await favorite(user, item);
    expect(on.status).toBe(200);
    expect(on.body.favoriteItems).toEqual([String(item._id)]);
    expect((await request(app).get("/users/me").set(...auth(user))).body.favoriteItems).toEqual([String(item._id)]);

    const off = await favorite(user, item, false);
    expect(off.body.favoriteItems).toEqual([]);
  });

  it("will not mark something the player does not hold, or an id that is not one", async () => {
    const user = await makeUser();
    expect((await favorite(user, await makeItem())).status).toBe(404);
    expect((await request(app).put("/users/favorites/nope").set(...auth(user)).send({ favorite: true })).status).toBe(400);
    expect((await request(app).put(`/users/favorites/${(await makeItem())._id}`).send({ favorite: true })).status).toBe(401);
  });
});

describe("what a favorite is locked out of", () => {
  it("a sell-all over a mix sells the rest and says how many favorites it left", async () => {
    const user = await makeUser();
    const kept = await makeItem();
    const sold = await makeItem();
    const keptIds = await give(user, kept, 2);
    const soldIds = await give(user, sold, 1);
    await favorite(user, kept);

    const res = await request(app).post("/users/inventory/sell").set(...auth(user)).send({ uniqueIds: [...keptIds, ...soldIds] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sold: 1, kept: 2, value: 75 });
    expect((await held(user)).sort()).toEqual([...keptIds].sort());
  });

  it("refuses to sell a favorite on its own, one copy or the stack, until it is unfavorited", async () => {
    const user = await makeUser();
    const item = await makeItem();
    const ids = await give(user, item, 2);
    await favorite(user, item);

    const one = await request(app).post("/users/inventory/sell").set(...auth(user)).send({ uniqueIds: [ids[1]] });
    expect(one.status).toBe(409);
    expect(one.body.code).toBe("favorite");
    const stack = await request(app).post("/users/inventory/sell").set(...auth(user)).send({ itemId: String(item._id) });
    expect(stack.status).toBe(409);
    expect((await held(user)).sort()).toEqual([...ids].sort());

    await favorite(user, item, false);
    const after = await request(app).post("/users/inventory/sell").set(...auth(user)).send({ uniqueIds: [ids[1]] });
    expect(after.body.sold).toBe(1);
  });

  it("refuses to list a favorite on the market", async () => {
    const user = await makeUser({ level: 20 });
    const item = await makeItem();
    const [uniqueId] = await give(user, item, 2);
    await favorite(user, item);

    const single = await request(app).post("/marketplace").set(...auth(user)).send({ item: uniqueId, price: 500 });
    const stack = await request(app).post("/marketplace").set(...auth(user)).send({ itemId: String(item._id), price: 500, quantity: 2 });

    expect([single.status, stack.status]).toEqual([409, 409]);
    expect(await held(user)).toHaveLength(2);
  });

  it("refuses to stake a favorite in an upgrade", async () => {
    const user = await makeUser();
    const item = await makeItem();
    const target = await Item.create({ name: `target-${uniqueSuffix()}`, image: "t.png", rarity: "4", baseValue: 1000 });
    const [uniqueId] = await give(user, item, 1);
    await favorite(user, item);

    const res = await request(app).post("/games/upgrade").set(...auth(user)).send({ selectedItemIds: [uniqueId], targetItemId: String(target._id) });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("favorite");
    expect(await held(user)).toEqual([uniqueId]);
  });

  it("the collection quicksell plans around favorites, and its duplicate figures agree", async () => {
    const user = await makeUser();
    const [fav, other] = [await makeItem(), await makeItem()];
    const box = await Case.create({ title: `case-${uniqueSuffix()}`, image: "c.png", price: 100, items: [fav._id, other._id] });
    await give(user, fav, 3);
    await give(user, other, 2);
    await favorite(user, fav);

    const preview = await request(app).post("/collections/quicksell/preview").set(...auth(user)).send({ caseId: String(box._id) });
    expect(preview.status).toBe(200);
    expect(preview.body.lines.map((l) => l._id)).toEqual([String(other._id)]);
    expect(preview.body.totalItems).toBe(1);

    const summary = await request(app).get(`/collections/summary?userId=${user._id}`);
    const row = summary.body.collections.find((c) => String(c.caseId) === String(box._id));
    expect(row).toMatchObject({ duplicatesCount: 1, duplicatesValue: 75 });
  });
});
