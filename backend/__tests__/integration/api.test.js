process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");
const Marketplace = require("../../models/Marketplace");
const Battle = require("../../models/Battle");
const { chargeUser } = require("../../utils/economy");
const battleEngine = require("../../games/battleEngine");

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

async function makeListing(seller, price = 100) {
  const item = await Item.create({ name: "Knife", image: "k.png", rarity: "5" });
  return Marketplace.create({
    sellerId: seller._id,
    item: item._id,
    price,
    itemName: "Knife",
    itemImage: "k.png",
    rarity: "5",
    uniqueId: `uid-${uniqueSuffix()}`,
  });
}

describe("economy.chargeUser", () => {
  test("rejects an overdraw and leaves the balance untouched", async () => {
    const u = await makeUser({ walletBalance: 50 });
    expect(await chargeUser(u._id, 100)).toBeNull();
    expect((await User.findById(u._id)).walletBalance).toBe(50);
  });

  test("concurrent charges cannot drive the balance negative", async () => {
    const u = await makeUser({ walletBalance: 100 });
    const results = await Promise.all([
      chargeUser(u._id, 100),
      chargeUser(u._id, 100),
      chargeUser(u._id, 100),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const after = await User.findById(u._id);
    expect(after.walletBalance).toBe(0);
    expect(after.walletBalance).toBeGreaterThanOrEqual(0);
  });
});

describe("GET /users/:id", () => {
  test("does not leak sensitive fields", async () => {
    const u = await makeUser({ email: "secret@x.com", isAdmin: true, walletBalance: 555 });
    const res = await request(app).get(`/users/${u._id}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(u.username);
    expect(res.body.email).toBeUndefined();
    expect(res.body.isAdmin).toBeUndefined();
    expect(res.body.walletBalance).toBeUndefined();
    expect(res.body.password).toBeUndefined();
  });
});

describe("marketplace buy", () => {
  test("you cannot buy your own listing", async () => {
    const seller = await makeUser({ walletBalance: 1000 });
    const listing = await makeListing(seller);
    const res = await request(app).post(`/marketplace/buy/${listing._id}`).set(...auth(seller));
    expect(res.status).toBe(400);
  });

  test("a buy transfers money + item and cannot be repeated", async () => {
    const seller = await makeUser({ walletBalance: 0 });
    const buyer = await makeUser({ walletBalance: 500 });
    const listing = await makeListing(seller, 100);

    const res = await request(app).post(`/marketplace/buy/${listing._id}`).set(...auth(buyer));
    expect(res.status).toBe(200);

    expect((await User.findById(buyer._id)).walletBalance).toBe(400);
    expect((await User.findById(seller._id)).walletBalance).toBe(100);
    const buyerInv = (await User.findById(buyer._id)).inventory;
    const bought = buyerInv.find((i) => i.uniqueId === listing.uniqueId);
    expect(bought).toBeDefined();
    // acquired now, so it sorts as newest (not the listing's createdAt)
    expect(Date.now() - new Date(bought.createdAt).getTime()).toBeLessThan(60000);

    const again = await request(app).post(`/marketplace/buy/${listing._id}`).set(...auth(buyer));
    expect(again.status).toBe(404);
  });

  test("two concurrent buyers cannot both win the same listing", async () => {
    const seller = await makeUser({ walletBalance: 0 });
    const b1 = await makeUser({ walletBalance: 500 });
    const b2 = await makeUser({ walletBalance: 500 });
    const listing = await makeListing(seller, 100);

    const [r1, r2] = await Promise.all([
      request(app).post(`/marketplace/buy/${listing._id}`).set(...auth(b1)),
      request(app).post(`/marketplace/buy/${listing._id}`).set(...auth(b2)),
    ]);

    expect([r1.status, r2.status].sort()).toEqual([200, 404]);
    expect((await User.findById(seller._id)).walletBalance).toBe(100); // paid exactly once
  });
});

describe("friends", () => {
  test("request then accept links both users", async () => {
    const a = await makeUser();
    const b = await makeUser();

    expect((await request(app).post(`/friends/request/${b._id}`).set(...auth(a))).status).toBe(200);
    expect((await request(app).post(`/friends/accept/${a._id}`).set(...auth(b))).status).toBe(200);

    const A = await User.findById(a._id);
    const B = await User.findById(b._id);
    expect(A.friends.map(String)).toContain(b._id.toString());
    expect(B.friends.map(String)).toContain(a._id.toString());
    expect(B.friendRequests.map(String)).not.toContain(a._id.toString());
  });

  test("cannot accept a request that was never sent", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const res = await request(app).post(`/friends/accept/${a._id}`).set(...auth(b));
    expect(res.status).toBe(400);
  });

  test("cannot friend yourself", async () => {
    const a = await makeUser();
    const res = await request(app).post(`/friends/request/${a._id}`).set(...auth(a));
    expect(res.status).toBe(400);
  });
});

describe("claimBonus", () => {
  test("can only be claimed once when fired concurrently", async () => {
    const u = await makeUser({ walletBalance: 0, bonusAmount: 200, nextBonus: new Date(Date.now() - 1000) });
    const [r1, r2] = await Promise.all([
      request(app).post(`/users/claimBonus`).set(...auth(u)),
      request(app).post(`/users/claimBonus`).set(...auth(u)),
    ]);
    expect([r1, r2].filter((r) => r.status === 200)).toHaveLength(1);
    expect((await User.findById(u._id)).walletBalance).toBe(200);
  });
});

describe("openCase", () => {
  test("charges the price and adds the items", async () => {
    const item = await Item.create({ name: "Card", image: "c.png", rarity: "1" });
    const c = await Case.create({ title: "Box", image: "b.png", price: 50, items: [item._id] });
    const u = await makeUser({ walletBalance: 200, level: 1 });

    const res = await request(app).post(`/games/openCase/${c._id}`).set(...auth(u)).send({ quantity: 2 });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);

    const after = await User.findById(u._id);
    expect(after.walletBalance).toBe(100); // 200 - 2*50
    expect(after.inventory).toHaveLength(2);
  });

  test("a case you can't afford is rejected and nothing is charged", async () => {
    const item = await Item.create({ name: "Card", image: "c.png", rarity: "1" });
    const c = await Case.create({ title: "Box", image: "b.png", price: 500, items: [item._id] });
    const u = await makeUser({ walletBalance: 100 });

    const res = await request(app).post(`/games/openCase/${c._id}`).set(...auth(u)).send({ quantity: 1 });
    expect(res.status).toBe(400);
    expect((await User.findById(u._id)).walletBalance).toBe(100);
  });
});

describe("selling items", () => {
  async function giveItem(user, baseValue, uniqueId, rarity = "5") {
    const item = await Item.create({ name: "Knife", image: "k.png", rarity, baseValue });
    await User.updateOne(
      { _id: user._id },
      { $push: { inventory: { _id: item._id, name: "Knife", image: "k.png", rarity, uniqueId, createdAt: new Date() } } }
    );
    return item;
  }

  test("selling credits 75% of base value and removes the item", async () => {
    const u = await makeUser({ walletBalance: 0 });
    await giveItem(u, 1000, "sell-1");
    const res = await request(app).post("/users/inventory/sell").set(...auth(u)).send({ uniqueId: "sell-1" });
    expect(res.status).toBe(200);
    expect(res.body.value).toBe(750);
    const after = await User.findById(u._id);
    expect(after.walletBalance).toBe(750);
    expect(after.inventory.some((i) => i.uniqueId === "sell-1")).toBe(false);
  });

  test("selling an item you do not have returns 404", async () => {
    const u = await makeUser();
    const res = await request(app).post("/users/inventory/sell").set(...auth(u)).send({ uniqueId: "missing" });
    expect(res.status).toBe(404);
  });

  test("the same item cannot be sold twice (no double credit)", async () => {
    const u = await makeUser({ walletBalance: 0 });
    await giveItem(u, 400, "dup-1", "3");
    const [r1, r2] = await Promise.all([
      request(app).post("/users/inventory/sell").set(...auth(u)).send({ uniqueId: "dup-1" }),
      request(app).post("/users/inventory/sell").set(...auth(u)).send({ uniqueId: "dup-1" }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 404]);
    expect((await User.findById(u._id)).walletBalance).toBe(300); // floor(400 * 0.75), once
  });
});

describe("case battles", () => {
  async function makeCase(price, baseValue) {
    const item = await Item.create({ name: "BattleItem", image: "b.png", rarity: "3", baseValue });
    const c = await Case.create({ title: "BattleCase", image: "c.png", price, items: [item._id] });
    return c;
  }

  test("start charges every player and the winner takes the whole pool", async () => {
    const c = await makeCase(50, 100);
    const a = await makeUser({ walletBalance: 200 });
    const b = await makeUser({ walletBalance: 200 });
    const battle = await Battle.create({
      mode: "1v1",
      cases: [c._id],
      entryCost: 50,
      createdBy: a._id,
      players: [
        { userId: a._id, username: a.username, team: 0, slot: 0, isBot: false },
        { userId: b._id, username: b.username, team: 1, slot: 1, isBot: false },
      ],
    });

    const res = await battleEngine.chargeAndStart(battle._id);
    expect(res.ok).toBe(true);
    expect((await User.findById(a._id)).walletBalance).toBe(150);
    expect((await User.findById(b._id)).walletBalance).toBe(150);

    const started = await Battle.findById(battle._id);
    expect(started.status).toBe("in_progress");
    expect(started.rolls).toHaveLength(1); // one case
    expect(started.rolls[0]).toHaveLength(2); // two slots

    const done = await battleEngine.finishBattle(started);
    expect(done.status).toBe("finished");
    expect(done.winnerUserIds).toHaveLength(1);
    const winner = await User.findById(done.winnerUserIds[0]);
    expect(winner.inventory).toHaveLength(2); // the whole pool (1 case x 2 slots)
  });

  test("start is rejected and nobody is charged if a player can't afford the entry", async () => {
    const c = await makeCase(100, 100);
    const a = await makeUser({ walletBalance: 200 });
    const poor = await makeUser({ walletBalance: 10 });
    const battle = await Battle.create({
      mode: "1v1",
      cases: [c._id],
      entryCost: 100,
      createdBy: a._id,
      players: [
        { userId: a._id, username: a.username, team: 0, slot: 0 },
        { userId: poor._id, username: poor.username, team: 1, slot: 1 },
      ],
    });

    const res = await battleEngine.chargeAndStart(battle._id);
    expect(res.error).toBeTruthy();
    expect((await User.findById(a._id)).walletBalance).toBe(200); // untouched
    expect((await Battle.findById(battle._id)).status).toBe("waiting");
  });

  test("a bot teammate's winnings sink (only humans receive)", async () => {
    const c = await makeCase(40, 100);
    const a = await makeUser({ walletBalance: 200 });
    // 1v1 vs a bot
    const battle = await Battle.create({
      mode: "1v1",
      cases: [c._id],
      entryCost: 40,
      createdBy: a._id,
      players: [
        { userId: a._id, username: a.username, team: 0, slot: 0, isBot: false },
        { userId: null, username: "Bot 2", team: 1, slot: 1, isBot: true },
      ],
    });

    const res = await battleEngine.chargeAndStart(battle._id);
    expect(res.ok).toBe(true);
    expect((await User.findById(a._id)).walletBalance).toBe(160); // only the human charged

    const done = await battleEngine.finishBattle(await Battle.findById(battle._id));
    // if the bot won, no human gets items and winnerUserIds is empty; if the human won, they get the pool
    if (done.winnerUserIds.length) {
      expect((await User.findById(a._id)).inventory).toHaveLength(2);
    } else {
      expect((await User.findById(a._id)).inventory).toHaveLength(0);
    }
  });
});

describe("input guards", () => {
  test("GET /users/:id with a non-ObjectId returns 404, not a 500", async () => {
    const res = await request(app).get("/users/undefined");
    expect(res.status).toBe(404);
  });

  test("GET /users/inventory/:userId with a bad id returns 404, not a 500", async () => {
    const res = await request(app).get("/users/inventory/undefined");
    expect(res.status).toBe(404);
  });

  test("inventory search with regex-special characters doesn't error", async () => {
    const u = await makeUser();
    const res = await request(app).get(`/users/inventory/${u._id}?name=${encodeURIComponent("((")}`);
    expect(res.status).toBe(200);
  });

  test("login against a passwordless (Google) account returns 400, not a 500", async () => {
    const u = await makeUser({ password: undefined });
    const res = await request(app).post("/users/login").send({ email: u.email, password: "whatever" });
    expect(res.status).toBe(400);
  });
});
