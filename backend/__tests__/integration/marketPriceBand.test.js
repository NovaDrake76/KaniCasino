process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Item = require("../../models/Item");
const Marketplace = require("../../models/Marketplace");
const BuyOrder = require("../../models/BuyOrder");

let app;
beforeAll(async () => { await setupDb(); app = makeApp(); });
// the ceiling only applies in real-money mode; each cap test turns it on
beforeEach(() => { process.env.REAL_MONEY_MODE = "true"; });
afterEach(async () => { delete process.env.REAL_MONEY_MODE; await clearDb(); });
afterAll(teardownDb);

const auth = (user) => ["Authorization", `Bearer ${tokenFor(user)}`];

const makeUser = (overrides = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance: 100000, level: 20, ...overrides });
};

const makeItem = (baseValue) =>
  Item.create({ name: `i-${uniqueSuffix()}`, image: "x", rarity: "3", baseValue });

// give the seller one copy of the item in inventory, return its uniqueId
async function giveItem(user, item) {
  const uniqueId = `uq-${uniqueSuffix()}`;
  await User.updateOne(
    { _id: user._id },
    { $push: { inventory: { _id: item._id, name: item.name, image: item.image, rarity: item.rarity, uniqueId } } }
  );
  return uniqueId;
}

test("a listing at up to 10x book value is allowed", async () => {
  const seller = await makeUser();
  const item = await makeItem(1000); // ceiling 10,000
  const uniqueId = await giveItem(seller, item);

  const res = await request(app).post("/marketplace").set(...auth(seller)).send({ item: uniqueId, price: 10000 });

  expect(res.status).toBe(200);
  expect(await Marketplace.countDocuments({ sellerId: seller._id })).toBe(1);
});

test("a listing far above book value is rejected (chip dumping)", async () => {
  const seller = await makeUser();
  const item = await makeItem(1000); // ceiling 10,000
  const uniqueId = await giveItem(seller, item);

  const res = await request(app).post("/marketplace").set(...auth(seller)).send({ item: uniqueId, price: 1000000 });

  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/too high/i);
  // the item stays in inventory, nothing is listed
  expect(await Marketplace.countDocuments({ sellerId: seller._id })).toBe(0);
  expect((await User.findById(seller._id)).inventory).toHaveLength(1);
});

test("an unvalued item is capped at the stand-in reference", async () => {
  const seller = await makeUser();
  const item = await makeItem(0); // ceiling = 100 * 10 = 1000
  const uniqueId = await giveItem(seller, item);

  const tooHigh = await request(app).post("/marketplace").set(...auth(seller)).send({ item: uniqueId, price: 5000 });
  expect(tooHigh.status).toBe(400);

  const ok = await request(app).post("/marketplace").set(...auth(seller)).send({ item: uniqueId, price: 1000 });
  expect(ok.status).toBe(200);
});

test("a buy order far above book value is rejected", async () => {
  const buyer = await makeUser();
  const item = await makeItem(1000); // ceiling 10,000

  const res = await request(app).post("/marketplace/orders").set(...auth(buyer)).send({ itemId: item._id, price: 500000, quantity: 1 });

  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/too high/i);
  expect(await BuyOrder.countDocuments({ userId: buyer._id })).toBe(0);
  expect((await User.findById(buyer._id)).walletBalance).toBe(100000); // no escrow taken
});

test("a buy order within the band still works", async () => {
  const buyer = await makeUser();
  const item = await makeItem(1000);

  const res = await request(app).post("/marketplace/orders").set(...auth(buyer)).send({ itemId: item._id, price: 5000, quantity: 1 });

  expect(res.status).toBe(200);
});

test("fake-balance mode leaves the market uncapped", async () => {
  delete process.env.REAL_MONEY_MODE; // the default: fake balances
  const seller = await makeUser();
  const item = await makeItem(1000); // would be capped at 10,000 in real mode
  const uniqueId = await giveItem(seller, item);

  const res = await request(app).post("/marketplace").set(...auth(seller)).send({ item: uniqueId, price: 1000000 });

  expect(res.status).toBe(200);
  expect(await Marketplace.countDocuments({ sellerId: seller._id })).toBe(1);
});
