process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");
const Marketplace = require("../../models/Marketplace");
const Transaction = require("../../models/Transaction");
const { chargeUser, creditUser, recordTransaction, TX } = require("../../utils/economy");

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
    walletBalance: 1000,
    level: 20,
    ...overrides,
  });
}

async function txFor(userId) {
  return Transaction.find({ userId }).sort({ createdAt: 1 });
}

describe("economy chokepoint writes the ledger", () => {
  test("chargeUser records a debit with balanceAfter", async () => {
    const u = await makeUser({ walletBalance: 500 });
    await chargeUser(u._id, 200, { type: TX.SLOT_BET, meta: { betAmount: 200 } });

    const tx = await txFor(u._id);
    expect(tx).toHaveLength(1);
    expect(tx[0].type).toBe("slot_bet");
    expect(tx[0].direction).toBe("debit");
    expect(tx[0].amount).toBe(200);
    expect(tx[0].balanceAfter).toBe(300);
  });

  test("creditUser records a credit with balanceAfter", async () => {
    const u = await makeUser({ walletBalance: 500 });
    await creditUser(u._id, 150, 0, { type: TX.SLOT_WIN });

    const tx = await txFor(u._id);
    expect(tx).toHaveLength(1);
    expect(tx[0].direction).toBe("credit");
    expect(tx[0].amount).toBe(150);
    expect(tx[0].balanceAfter).toBe(650);
  });

  test("a rejected overdraw records nothing", async () => {
    const u = await makeUser({ walletBalance: 50 });
    expect(await chargeUser(u._id, 100, { type: TX.SLOT_BET })).toBeNull();
    expect(await txFor(u._id)).toHaveLength(0);
  });

  test("a credit to a missing account records nothing", async () => {
    const u = await makeUser();
    await User.deleteOne({ _id: u._id });
    expect(await creditUser(u._id, 100, 0, { type: TX.MARKET_SALE })).toBeNull();
    expect(await txFor(u._id)).toHaveLength(0);
  });

  test("a zero-amount move is not recorded", async () => {
    const u = await makeUser();
    await recordTransaction({ userId: u._id, type: TX.ITEM_SELL, direction: "credit", amount: 0 });
    expect(await txFor(u._id)).toHaveLength(0);
  });
});

describe("money paths record a transaction", () => {
  test("register grants and records the welcome bonus", async () => {
    const s = uniqueSuffix();
    const res = await request(app)
      .post("/users/register")
      .send({ email: `new-${s}@x.com`, username: `new-${s}`, password: "secret1", profilePicture: "" });
    expect(res.status).toBe(200);

    const u = await User.findOne({ username: `new-${s}` });
    const tx = await txFor(u._id);
    expect(tx).toHaveLength(1);
    expect(tx[0].type).toBe("signup");
    expect(tx[0].direction).toBe("credit");
    expect(tx[0].amount).toBe(u.walletBalance);
  });

  test("opening a case records a case_open debit", async () => {
    const item = await Item.create({ name: "Card", image: "c.png", rarity: "1" });
    const c = await Case.create({ title: "Box", image: "b.png", price: 50, items: [item._id] });
    const u = await makeUser({ walletBalance: 200, level: 1 });

    await request(app).post(`/games/openCase/${c._id}`).set(...auth(u)).send({ quantity: 2 });

    const tx = (await txFor(u._id)).filter((t) => t.type === "case_open");
    expect(tx).toHaveLength(1);
    expect(tx[0].direction).toBe("debit");
    expect(tx[0].amount).toBe(100);
    expect(tx[0].balanceAfter).toBe(100);
    expect(tx[0].meta.quantity).toBe(2);
  });

  test("claiming the bonus records a bonus credit", async () => {
    const u = await makeUser({ walletBalance: 0, bonusAmount: 200, nextBonus: new Date(Date.now() - 1000) });
    await request(app).post("/users/claimBonus").set(...auth(u));

    const tx = (await txFor(u._id)).filter((t) => t.type === "bonus");
    expect(tx).toHaveLength(1);
    expect(tx[0].amount).toBe(200);
    expect(tx[0].balanceAfter).toBe(200);
  });

  test("selling to the shop records an item_sell credit", async () => {
    const u = await makeUser({ walletBalance: 0 });
    const item = await Item.create({ name: "Knife", image: "k.png", rarity: "5", baseValue: 1000 });
    await User.updateOne(
      { _id: u._id },
      { $push: { inventory: { _id: item._id, name: "Knife", image: "k.png", rarity: "5", uniqueId: "sell-1", createdAt: new Date() } } }
    );

    await request(app).post("/users/inventory/sell").set(...auth(u)).send({ uniqueId: "sell-1" });

    const tx = (await txFor(u._id)).filter((t) => t.type === "item_sell");
    expect(tx).toHaveLength(1);
    expect(tx[0].amount).toBe(750);
    expect(tx[0].balanceAfter).toBe(750);
  });

  test("a marketplace buy records both sides of the trade", async () => {
    const seller = await makeUser({ walletBalance: 0 });
    const buyer = await makeUser({ walletBalance: 500 });
    const item = await Item.create({ name: "Knife", image: "k.png", rarity: "5" });
    const listing = await Marketplace.create({
      sellerId: seller._id,
      item: item._id,
      price: 100,
      itemName: "Knife",
      itemImage: "k.png",
      rarity: "5",
      uniqueId: `uid-${uniqueSuffix()}`,
    });

    const res = await request(app).post(`/marketplace/buy/${listing._id}`).set(...auth(buyer));
    expect(res.status).toBe(200);

    const buyerTx = (await txFor(buyer._id)).filter((t) => t.type === "market_buy");
    expect(buyerTx).toHaveLength(1);
    expect(buyerTx[0].direction).toBe("debit");
    expect(buyerTx[0].amount).toBe(100);

    const sellerTx = (await txFor(seller._id)).filter((t) => t.type === "market_sale");
    expect(sellerTx).toHaveLength(1);
    expect(sellerTx[0].direction).toBe("credit");
    expect(sellerTx[0].amount).toBe(100);
  });

  test("a buy reverses cleanly when the seller no longer exists", async () => {
    const seller = await makeUser({ walletBalance: 0 });
    const buyer = await makeUser({ walletBalance: 500 });
    const item = await Item.create({ name: "Knife", image: "k.png", rarity: "5" });
    const listing = await Marketplace.create({
      sellerId: seller._id,
      item: item._id,
      price: 100,
      itemName: "Knife",
      itemImage: "k.png",
      rarity: "5",
      uniqueId: `uid-${uniqueSuffix()}`,
    });
    await User.deleteOne({ _id: seller._id });

    const res = await request(app).post(`/marketplace/buy/${listing._id}`).set(...auth(buyer));
    expect(res.status).toBe(410);

    const after = await User.findById(buyer._id);
    expect(after.walletBalance).toBe(500); // fully refunded
    expect(after.inventory.some((i) => i.uniqueId === listing.uniqueId)).toBe(false); // item removed

    const buyerTx = await txFor(buyer._id);
    expect(buyerTx.filter((t) => t.direction === "debit")).toHaveLength(1);
    expect(buyerTx.filter((t) => t.direction === "credit" && t.meta.reversal)).toHaveLength(1);
  });
});

describe("GET /users/transactions", () => {
  test("returns only the caller's history, newest first, paginated", async () => {
    const me = await makeUser();
    const other = await makeUser();

    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      await Transaction.create({
        userId: me._id,
        type: TX.CASE_OPEN,
        direction: "debit",
        amount: (i + 1) * 10,
        createdAt: new Date(base + i * 1000),
      });
    }
    await Transaction.create({ userId: other._id, type: TX.BONUS, direction: "credit", amount: 999 });

    const page1 = await request(app).get("/users/transactions?limit=2&page=1").set(...auth(me));
    expect(page1.status).toBe(200);
    expect(page1.body.transactions).toHaveLength(2);
    expect(page1.body.total).toBe(5);
    expect(page1.body.totalPages).toBe(3);
    // newest first: the last-created (amount 50) comes first
    expect(page1.body.transactions[0].amount).toBe(50);
    expect(page1.body.transactions[1].amount).toBe(40);
    expect(page1.body.transactions.every((t) => t.userId === me._id.toString())).toBe(true);

    const page3 = await request(app).get("/users/transactions?limit=2&page=3").set(...auth(me));
    expect(page3.body.transactions).toHaveLength(1);
    expect(page3.body.transactions[0].amount).toBe(10); // oldest last
  });

  test("requires authentication", async () => {
    const res = await request(app).get("/users/transactions");
    expect(res.status).toBe(401);
  });

  test("clamps out-of-range page/limit instead of 500ing", async () => {
    const me = await makeUser();
    await Transaction.create({ userId: me._id, type: TX.BONUS, direction: "credit", amount: 10 });

    const negPage = await request(app).get("/users/transactions?page=-1").set(...auth(me));
    expect(negPage.status).toBe(200);
    expect(negPage.body.currentPage).toBe(1);

    const negLimit = await request(app).get("/users/transactions?limit=-1").set(...auth(me));
    expect(negLimit.status).toBe(200);
    expect(negLimit.body.totalPages).toBeGreaterThanOrEqual(0);

    const hugeLimit = await request(app).get("/users/transactions?limit=99999").set(...auth(me));
    expect(hugeLimit.status).toBe(200); // capped at 50 server-side
  });
});
