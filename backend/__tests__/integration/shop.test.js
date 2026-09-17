process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const ChatMessage = require("../../models/ChatMessage");
const chat = require("../../utils/chat");
const { TX } = require("../../utils/economy");
const { MINT } = require("../../utils/accounts");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(async () => {
  await clearDb();
  chat.reset();
});
afterAll(teardownDb);

const makeUser = (fields = {}) => {
  const s = uniqueSuffix();
  return User.create({
    username: `Aya ${s}`,
    slug: `aya-${s}`,
    email: `a${s}@k.co`,
    password: "x",
    walletBalance: 10000,
    level: 6,
    betaFlags: ["daisu"],
    ...fields,
  });
};

const as = (user, req) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const shopOf = (user) => as(user, request(app).get("/daisu/shop"));
const buy = (user, key) => as(user, request(app).post(`/daisu/shop/${key}/buy`));
const item = (body, key) => body.items.find((i) => i.key === key);
const someId = () => new mongoose.Types.ObjectId().toString();

describe("daisu's shop", () => {
  it("lists what she sells to an account in her beta, and nothing to one outside it", async () => {
    const user = await makeUser();

    const res = await shopOf(user);

    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => i.key)).toEqual(["chatPass", "tradersLicense", "collectionBook", "predictionPass"]);
    expect(item(res.body, "chatPass")).toMatchObject({ price: 1000, level: 5, owned: false, via: null });
    expect(res.body).toMatchObject({ walletBalance: 10000, level: 6 });
    expect((await shopOf(await makeUser({ betaFlags: [] }))).status).toBe(403);
  });

  it("sells an item once: the KP goes to the mint and the feature is the player's", async () => {
    const user = await makeUser();

    const res = await buy(user, "tradersLicense");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ bought: true, key: "tradersLicense", walletBalance: 7000, unlocks: ["tradersLicense"] });
    expect(item(res.body.shop, "tradersLicense")).toMatchObject({ owned: true, via: "bought" });
    const rows = await Transaction.find({ userId: user._id, type: TX.SHOP_PURCHASE }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ direction: "debit", amount: 3000, balanceAfter: 7000, meta: { unlock: "tradersLicense" } });
    expect(String(rows[0].counterparty)).toBe(String(MINT));

    const again = await buy(user, "tradersLicense");

    expect(again.body).toMatchObject({ bought: false, alreadyOwned: true });
    expect((await User.findById(user._id).lean()).walletBalance).toBe(7000);
  });

  it("charges once when several purchases of the same item land together", async () => {
    const user = await makeUser();

    const results = await Promise.all([buy(user, "chatPass"), buy(user, "chatPass"), buy(user, "chatPass")]);

    expect(results.filter((r) => r.body.bought)).toHaveLength(1);
    const fresh = await User.findById(user._id).lean();
    expect(fresh.walletBalance).toBe(9000);
    expect(fresh.unlocks.filter((u) => u.key === "chatPass")).toHaveLength(1);
    expect(await Transaction.countDocuments({ userId: user._id, type: TX.SHOP_PURCHASE })).toBe(1);
  });

  it("refuses what the level or the wallet cannot cover, and anything it does not sell", async () => {
    const user = await makeUser({ walletBalance: 300 });

    expect((await buy(user, "predictionPass")).body).toMatchObject({ reason: "level" });
    const broke = await buy(user, "chatPass");
    expect(broke.status).toBe(400);
    expect(broke.body.reason).toBe("funds");
    expect((await buy(user, "goldenTicket")).status).toBe(404);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(0);
  });

  it("keeps what an account already used, reading its history only the first time", async () => {
    const user = await makeUser({ badges: [{ key: "collection:abc", awardedAt: new Date() }] });
    await Transaction.create({ userId: user._id, type: TX.MARKET_SALE, direction: "credit", amount: 40 });

    const first = (await shopOf(user)).body;

    expect(item(first, "tradersLicense")).toMatchObject({ owned: true, via: "history" });
    expect(item(first, "collectionBook")).toMatchObject({ owned: true, via: "history" });
    expect(item(first, "chatPass").owned).toBe(false);

    await ChatMessage.create({ userId: user._id, username: user.username, text: "hi", at: new Date() });

    expect(item((await shopOf(user)).body, "chatPass").owned).toBe(false);
  });

  it("hands /users/me the unlocks of an account in her beta, and nothing for anyone else", async () => {
    const user = await makeUser();
    await buy(user, "chatPass");

    expect((await as(user, request(app).get("/users/me"))).body.unlocks).toEqual(["chatPass"]);
    const outsider = await makeUser({ betaFlags: [] });
    expect((await as(outsider, request(app).get("/users/me"))).body.unlocks).toBeUndefined();
  });

  it("locks the market, trading predictions and quicksell until the item is theirs, and never the upgrade game", async () => {
    const user = await makeUser();

    const res = [
      await as(user, request(app).post("/marketplace").send({ item: "x", price: 10 })),
      await as(user, request(app).post(`/marketplace/buy/${someId()}`)),
      await as(user, request(app).post("/marketplace/orders").send({ itemId: someId(), price: 10 })),
      await as(user, request(app).post("/predictions/nothing/trade").send({ outcome: "yes", action: "buy", shares: 1 })),
      await as(user, request(app).post("/collections/quicksell/preview").send({ caseId: someId() })),
    ];

    expect(res.map((r) => [r.status, r.body.reason])).toEqual(Array(5).fill([403, "locked"]));
    expect(res.map((r) => r.body.unlock)).toEqual(["tradersLicense", "tradersLicense", "tradersLicense", "predictionPass", "collectionBook"]);

    const upgrade = await as(user, request(app).post("/games/upgrade").send({ selectedItemIds: [], targetItemId: someId() }));
    expect(upgrade.body.reason).not.toBe("locked");
  });

  it("lets a licensed trader buy below level 10, where anyone outside the beta still needs the level", async () => {
    const trader = await makeUser({ level: 5 });
    await buy(trader, "tradersLicense");

    const res = await as(trader, request(app).post(`/marketplace/buy/${someId()}`));

    expect(res.status).not.toBe(403);
    expect(res.body.message || "").not.toMatch(/level/i);
    const refused = await as(await makeUser({ betaFlags: [], level: 5 }), request(app).post(`/marketplace/buy/${someId()}`));
    expect(refused.status).toBe(400);
    expect(refused.body.message).toMatch(/level 10/);
  });

  it("needs a chat pass to talk in the beta instead of a level, and keeps chat for anyone who already talked", async () => {
    const user = await makeUser();

    expect((await chat.send(user._id, "hello there")).error).toBe("locked");

    await buy(user, "chatPass");

    expect((await chat.send(user._id, "hello there")).error).toBeUndefined();

    const regular = await makeUser({ level: 2 });
    await ChatMessage.create({ userId: regular._id, username: regular.username, text: "old news", at: new Date() });

    expect((await chat.send(regular._id, "still here")).error).toBeUndefined();
  });
});
