process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Marketplace = require("../../models/Marketplace");
const MarketSale = require("../../models/MarketSale");
const BuyOrder = require("../../models/BuyOrder");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");

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
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    walletBalance: 10000,
    level: 20,
    ...overrides,
  });
}

async function makeItem(overrides = {}) {
  return Item.create({
    name: `Knife-${uniqueSuffix()}`,
    image: "k.png",
    rarity: "5",
    baseValue: 1000,
    ...overrides,
  });
}

async function makeListing(seller, item, price = 100) {
  return Marketplace.create({
    sellerId: seller._id,
    item: item._id,
    price,
    itemName: item.name,
    itemImage: item.image,
    rarity: item.rarity,
    uniqueId: `uid-${uniqueSuffix()}`,
  });
}

function giveItem(user, item, uniqueId) {
  return User.updateOne(
    { _id: user._id },
    {
      $push: {
        inventory: {
          _id: item._id,
          name: item.name,
          image: item.image,
          rarity: item.rarity,
          uniqueId,
          createdAt: new Date(),
        },
      },
    }
  );
}

describe("market fee + sale history", () => {
  test("a buy takes the 5% fee, pays the seller the rest, and records the sale", async () => {
    const seller = await makeUser({ walletBalance: 0 });
    const buyer = await makeUser({ walletBalance: 500 });
    const item = await makeItem();
    const listing = await makeListing(seller, item, 100);

    const res = await request(app).post(`/marketplace/buy/${listing._id}`).set(...auth(buyer));
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(100);

    expect((await User.findById(buyer._id)).walletBalance).toBe(400); // paid full price
    expect((await User.findById(seller._id)).walletBalance).toBe(95); // kept 95%

    const sales = await MarketSale.find({ item: item._id });
    expect(sales).toHaveLength(1);
    expect(sales[0].price).toBe(100);
    expect(sales[0].fee).toBe(5);
    expect(sales[0].sellerNet).toBe(95);
    expect(String(sales[0].buyerId)).toBe(String(buyer._id));
  });

  test("history reports median, volume and the house floor", async () => {
    const seller = await makeUser();
    const item = await makeItem({ baseValue: 1000 }); // floor = 750
    const now = Date.now();
    for (const p of [100, 200, 300]) {
      await MarketSale.create({
        item: item._id,
        itemName: item.name,
        price: p,
        fee: 0,
        sellerNet: p,
        sellerId: seller._id,
        soldAt: new Date(now - 3600 * 1000),
      });
    }
    await makeListing(seller, item, 180);

    const res = await request(app).get(`/marketplace/item/${item._id}/history?range=week`);
    expect(res.status).toBe(200);
    expect(res.body.stats.median7d).toBe(200);
    expect(res.body.stats.volume7d).toBe(3);
    expect(res.body.stats.floor).toBe(750);
    expect(res.body.stats.lowestListing).toBe(180);
    expect(res.body.stats.feeRate).toBe(0.05);
    expect(res.body.points.length).toBeGreaterThan(0);
    expect(res.body.points[0].median).toBe(200);
  });

  test("history only counts sales inside the range", async () => {
    const seller = await makeUser();
    const item = await makeItem();
    await MarketSale.create({
      item: item._id,
      price: 999,
      sellerId: seller._id,
      soldAt: new Date(Date.now() - 60 * 24 * 3600 * 1000), // 60 days ago
    });
    const res = await request(app).get(`/marketplace/item/${item._id}/history?range=week`);
    expect(res.body.stats.volume7d).toBe(0);
    expect(res.body.stats.median7d).toBeNull();
    expect(res.body.points).toHaveLength(0);
  });
});

describe("browse sorting", () => {
  test("sortBy=price orders by cheapest listing (used to be ignored)", async () => {
    const seller = await makeUser();
    const cheap = await makeItem({ name: `AAA-${uniqueSuffix()}` });
    const pricey = await makeItem({ name: `BBB-${uniqueSuffix()}` });
    await makeListing(seller, cheap, 10);
    await makeListing(seller, pricey, 900);

    const res = await request(app).get("/marketplace/?sortBy=price&order=asc&listedOnly=1");
    expect(res.status).toBe(200);
    const names = res.body.items.map((i) => i.name);
    expect(names.indexOf(cheap.name)).toBeLessThan(names.indexOf(pricey.name));

    const desc = await request(app).get("/marketplace/?sortBy=price&order=desc&listedOnly=1");
    const dnames = desc.body.items.map((i) => i.name);
    expect(dnames.indexOf(pricey.name)).toBeLessThan(dnames.indexOf(cheap.name));
  });

  test("listedOnly hides items with no listings", async () => {
    const seller = await makeUser();
    const listed = await makeItem();
    const bare = await makeItem();
    await makeListing(seller, listed, 50);

    const all = await request(app).get("/marketplace/");
    expect(all.body.items.some((i) => i.name === bare.name)).toBe(true);

    const only = await request(app).get("/marketplace/?listedOnly=1");
    expect(only.body.items.some((i) => i.name === bare.name)).toBe(false);
    expect(only.body.items.some((i) => i.name === listed.name)).toBe(true);
  });
});

describe("buy orders", () => {
  test("placing an order fills instantly from cheap listings and escrows the rest", async () => {
    const seller = await makeUser({ walletBalance: 0 });
    const buyer = await makeUser({ walletBalance: 1000 });
    const item = await makeItem();
    await makeListing(seller, item, 100);

    const res = await request(app)
      .post("/marketplace/orders")
      .set(...auth(buyer))
      .send({ itemId: item._id, price: 150, quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.filled).toBe(1); // one listing existed at <= 150
    expect(res.body.order.quantity).toBe(2); // the rest rests as an order
    expect(res.body.order.escrow).toBe(300); // 2 x 150 held

    // 100 spent on the fill + 300 escrowed
    expect((await User.findById(buyer._id)).walletBalance).toBe(600);
    expect((await User.findById(seller._id)).walletBalance).toBe(95);
  });

  test("a new listing fills a resting order at the bid price and pays the seller net", async () => {
    const buyer = await makeUser({ walletBalance: 1000 });
    const seller = await makeUser({ walletBalance: 0, level: 20 });
    const item = await makeItem();

    // buyer bids 200, nothing to fill -> rests with 200 escrowed
    const placed = await request(app)
      .post("/marketplace/orders")
      .set(...auth(buyer))
      .send({ itemId: item._id, price: 200, quantity: 1 });
    expect(placed.body.order.escrow).toBe(200);
    expect((await User.findById(buyer._id)).walletBalance).toBe(800);

    // seller lists at 120: crosses the resting 200 bid, so it clears at 200
    await giveItem(seller, item, "sell-me");
    const listed = await request(app)
      .post("/marketplace/")
      .set(...auth(seller))
      .send({ item: "sell-me", price: 120 });

    expect(listed.status).toBe(200);
    expect(listed.body.soldInstantly).toBe(true);
    expect(listed.body.soldFor).toBe(200); // price improvement to the seller
    expect(listed.body.received).toBe(190); // 200 minus the 5% fee

    expect((await User.findById(seller._id)).walletBalance).toBe(190);
    // buyer already paid via escrow, so the wallet does not move again
    expect((await User.findById(buyer._id)).walletBalance).toBe(800);
    const buyerInv = (await User.findById(buyer._id)).inventory;
    expect(buyerInv.some((i) => i.uniqueId === "sell-me")).toBe(true);

    const order = await BuyOrder.findById(placed.body.order._id);
    expect(order.filled).toBe(1);
    expect(order.escrow).toBe(0);
    expect(order.status).toBe("filled");
    expect(await Marketplace.countDocuments({ item: item._id })).toBe(0); // listing consumed

    const sale = await MarketSale.findOne({ item: item._id });
    expect(sale.price).toBe(200);
    expect(sale.viaOrder).toBe(true);
  });

  test("cancelling an order refunds exactly the remaining escrow, once", async () => {
    const buyer = await makeUser({ walletBalance: 1000 });
    const item = await makeItem();
    const placed = await request(app)
      .post("/marketplace/orders")
      .set(...auth(buyer))
      .send({ itemId: item._id, price: 100, quantity: 4 });
    expect((await User.findById(buyer._id)).walletBalance).toBe(600); // 400 escrowed

    const id = placed.body.order._id;
    const [c1, c2] = await Promise.all([
      request(app).delete(`/marketplace/orders/${id}`).set(...auth(buyer)),
      request(app).delete(`/marketplace/orders/${id}`).set(...auth(buyer)),
    ]);
    // exactly one cancel wins
    expect([c1.status, c2.status].sort()).toEqual([200, 404]);
    expect((await User.findById(buyer._id)).walletBalance).toBe(1000); // refunded once
    const refunds = await Transaction.find({ userId: buyer._id, type: TX.MARKET_ORDER_REFUND });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amount).toBe(400);
  });

  test("two listings cannot overfill a one-unit order", async () => {
    const buyer = await makeUser({ walletBalance: 1000 });
    const s1 = await makeUser({ walletBalance: 0 });
    const s2 = await makeUser({ walletBalance: 0 });
    const item = await makeItem();

    await request(app)
      .post("/marketplace/orders")
      .set(...auth(buyer))
      .send({ itemId: item._id, price: 100, quantity: 1 });

    await giveItem(s1, item, "a-1");
    await giveItem(s2, item, "b-1");

    const [r1, r2] = await Promise.all([
      request(app).post("/marketplace/").set(...auth(s1)).send({ item: "a-1", price: 90 }),
      request(app).post("/marketplace/").set(...auth(s2)).send({ item: "b-1", price: 90 }),
    ]);

    const sold = [r1.body, r2.body].filter((b) => b.soldInstantly);
    expect(sold).toHaveLength(1); // only one filled the single-unit order

    const order = await BuyOrder.findOne({ userId: buyer._id });
    expect(order.filled).toBe(1);
    expect(order.escrow).toBe(0);
    // the loser stays listed on the market
    expect(await Marketplace.countDocuments({ item: item._id })).toBe(1);
    expect(await MarketSale.countDocuments({ item: item._id })).toBe(1);
  });

  test("you cannot fill your own buy order", async () => {
    const u = await makeUser({ walletBalance: 1000 });
    const item = await makeItem();
    await request(app)
      .post("/marketplace/orders")
      .set(...auth(u))
      .send({ itemId: item._id, price: 200, quantity: 1 });

    await giveItem(u, item, "mine-1");
    const listed = await request(app).post("/marketplace/").set(...auth(u)).send({ item: "mine-1", price: 100 });
    expect(listed.body.soldInstantly).toBeUndefined(); // just listed, not self-filled
    expect(await MarketSale.countDocuments({ item: item._id })).toBe(0);
  });

  test("an order needs the funds to escrow", async () => {
    const buyer = await makeUser({ walletBalance: 50 });
    const item = await makeItem();
    const res = await request(app)
      .post("/marketplace/orders")
      .set(...auth(buyer))
      .send({ itemId: item._id, price: 100, quantity: 1 });
    expect(res.status).toBe(400);
    expect(await BuyOrder.countDocuments({ userId: buyer._id })).toBe(0);
    expect((await User.findById(buyer._id)).walletBalance).toBe(50);
  });

  test("the order book aggregates open bids by price", async () => {
    const b1 = await makeUser({ walletBalance: 5000 });
    const b2 = await makeUser({ walletBalance: 5000 });
    const item = await makeItem();
    await request(app).post("/marketplace/orders").set(...auth(b1)).send({ itemId: item._id, price: 100, quantity: 2 });
    await request(app).post("/marketplace/orders").set(...auth(b2)).send({ itemId: item._id, price: 100, quantity: 3 });
    await request(app).post("/marketplace/orders").set(...auth(b2)).send({ itemId: item._id, price: 50, quantity: 1 });

    const res = await request(app).get(`/marketplace/item/${item._id}/orders`);
    expect(res.status).toBe(200);
    expect(res.body.orders[0]).toEqual({ price: 100, quantity: 5 }); // highest bid first, merged
    expect(res.body.orders[1]).toEqual({ price: 50, quantity: 1 });
  });
});
