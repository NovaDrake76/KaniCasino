process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Transaction = require("../../models/Transaction");
const PokerTable = require("../../models/PokerTable");
const { buyIn, cashOut, cashOutOptions, blankSeats } = require("../../games/pokerTable");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

const makeTable = (over = {}) =>
  PokerTable.create({
    slug: `t-${uniqueSuffix()}`,
    name: "Test Table",
    seatCount: 6,
    smallBlind: 5,
    bigBlind: 10,
    minBuyIn: 200,
    maxBuyIn: 2000,
    seats: blankSeats(6),
    ...over,
  });

async function makeUser(walletBalance = 10000) {
  const s = uniqueSuffix();
  return User.create({
    username: `u-${s}`,
    email: `u-${s}@e.com`,
    password: "x",
    walletBalance,
  });
}

// baseValue 1000 sells for 750 at the house rate, which is what a stake is worth
async function giveItem(user, baseValue, name) {
  const item = await Item.create({ name: name || `i-${uniqueSuffix()}`, image: "x.png", rarity: "4", baseValue });
  const uniqueId = `uq-${uniqueSuffix()}`;
  await User.updateOne(
    { _id: user._id },
    { $push: { inventory: { _id: item._id, name: item.name, image: item.image, rarity: item.rarity, uniqueId } } }
  );
  return { item, uniqueId };
}

const reload = (id) => PokerTable.findById(id);

describe("buying in", () => {
  it("seats a player and charges the wallet", async () => {
    const table = await makeTable();
    const user = await makeUser(1000);

    const res = await buyIn(table._id, user._id, { seat: 2, kp: 500 });
    expect(res.ok).toBe(true);
    expect(res.stack).toBe(500);

    const after = await reload(table._id);
    expect(after.seats[2].userId.toString()).toBe(user._id.toString());
    expect(after.seats[2].stack).toBe(500);
    expect(after.seats[2].clientSeed).toBeTruthy();
    expect((await User.findById(user._id)).walletBalance).toBe(500);
  });

  it("writes a ledger row", async () => {
    const table = await makeTable();
    const user = await makeUser(1000);
    await buyIn(table._id, user._id, { seat: 0, kp: 500 });

    const tx = await Transaction.findOne({ userId: user._id, type: "poker_buyin" });
    expect(tx.direction).toBe("debit");
    expect(tx.amount).toBe(500);
    expect(tx.balanceAfter).toBe(500);
  });

  it("takes items into the cage and counts them toward the stack", async () => {
    const table = await makeTable();
    const user = await makeUser(1000);
    const { uniqueId } = await giveItem(user, 1000);

    const res = await buyIn(table._id, user._id, { seat: 0, kp: 100, uniqueIds: [uniqueId] });
    expect(res.ok).toBe(true);
    expect(res.stack).toBe(850); // 100 kp + 750 sell value

    const after = await reload(table._id);
    expect(after.pool).toHaveLength(1);
    expect(after.pool[0].value).toBe(750);
    expect(after.pool[0].stakedBy).toBe(0);
  });

  // escrow is by removal, which is also the whole of the item lock-out: sell, market,
  // upgrade, fixedItem and the avatar picker all read user.inventory
  it("removes a staked item from the inventory entirely", async () => {
    const table = await makeTable();
    const user = await makeUser(1000);
    const { uniqueId } = await giveItem(user, 1000);

    await buyIn(table._id, user._id, { seat: 0, kp: 100, uniqueIds: [uniqueId] });

    const after = await User.findById(user._id);
    expect(after.inventory.find((e) => e.uniqueId === uniqueId)).toBeUndefined();
    expect(await User.exists({ _id: user._id, "inventory.uniqueId": uniqueId })).toBeNull();
  });

  it("refuses a buy-in under the minimum", async () => {
    const table = await makeTable();
    const user = await makeUser(1000);
    expect((await buyIn(table._id, user._id, { seat: 0, kp: 50 })).error).toMatch(/Minimum/);
  });

  it("refuses a buy-in over the maximum", async () => {
    const table = await makeTable();
    const user = await makeUser(100000);
    expect((await buyIn(table._id, user._id, { seat: 0, kp: 5000 })).error).toMatch(/Maximum/);
  });

  it("refuses more kp than the player has", async () => {
    const table = await makeTable();
    const user = await makeUser(300);
    const res = await buyIn(table._id, user._id, { seat: 0, kp: 500 });
    expect(res.error).toBeTruthy();
    const after = await reload(table._id);
    expect(after.seats[0].status).toBe("empty");
    expect((await User.findById(user._id)).walletBalance).toBe(300);
  });

  it("refuses an item the player does not own", async () => {
    const table = await makeTable();
    const user = await makeUser(1000);
    const other = await makeUser(1000);
    const { uniqueId } = await giveItem(other, 1000);

    const res = await buyIn(table._id, user._id, { seat: 0, kp: 300, uniqueIds: [uniqueId] });
    expect(res.error).toBeTruthy();
    expect((await reload(table._id)).seats[0].status).toBe("empty");
  });

  it("refuses a second seat at the same table", async () => {
    const table = await makeTable();
    const user = await makeUser(10000);
    await buyIn(table._id, user._id, { seat: 0, kp: 500 });
    expect((await buyIn(table._id, user._id, { seat: 1, kp: 500 })).error).toBeTruthy();
  });

  it("refuses a seat that does not exist", async () => {
    const table = await makeTable();
    const user = await makeUser(10000);
    expect((await buyIn(table._id, user._id, { seat: 9, kp: 500 })).error).toBeTruthy();
    expect((await buyIn(table._id, user._id, { seat: -1, kp: 500 })).error).toBeTruthy();
  });

  it("gives a contested seat to exactly one of two simultaneous claims", async () => {
    const table = await makeTable();
    const a = await makeUser(10000);
    const b = await makeUser(10000);

    const results = await Promise.all([
      buyIn(table._id, a._id, { seat: 3, kp: 500 }),
      buyIn(table._id, b._id, { seat: 3, kp: 500 }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => r.error)).toHaveLength(1);

    const after = await reload(table._id);
    expect(after.seats[3].status).toBe("sitting");
    expect(after.seats.filter((s) => s.status !== "empty")).toHaveLength(1);
  });

  it("never lets one player stake the same item onto two tables", async () => {
    const one = await makeTable();
    const two = await makeTable();
    const user = await makeUser(10000);
    const { uniqueId } = await giveItem(user, 1000);

    const results = await Promise.all([
      buyIn(one._id, user._id, { seat: 0, kp: 100, uniqueIds: [uniqueId] }),
      buyIn(two._id, user._id, { seat: 0, kp: 100, uniqueIds: [uniqueId] }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);

    const pools = (await PokerTable.find({ _id: { $in: [one._id, two._id] } })).flatMap((t) => t.pool);
    expect(pools).toHaveLength(1);
  });
});

describe("cashing out", () => {
  it("pays a pure kp stack straight back", async () => {
    const table = await makeTable();
    const user = await makeUser(1000);
    await buyIn(table._id, user._id, { seat: 0, kp: 500 });

    const res = await cashOut(table._id, user._id);
    expect(res.ok).toBe(true);
    expect(res.kp).toBe(500);
    expect((await User.findById(user._id)).walletBalance).toBe(1000);
    expect((await reload(table._id)).seats[0].status).toBe("empty");
  });

  it("gives back the item when the chips still cover it", async () => {
    const table = await makeTable();
    const user = await makeUser(1000);
    const { uniqueId } = await giveItem(user, 1000);
    await buyIn(table._id, user._id, { seat: 0, kp: 100, uniqueIds: [uniqueId] });

    const res = await cashOut(table._id, user._id);
    expect(res.items.map((e) => e.uniqueId)).toEqual([uniqueId]);
    expect(res.kp).toBe(100);
    expect(await User.exists({ _id: user._id, "inventory.uniqueId": uniqueId })).toBeTruthy();
    expect((await reload(table._id)).pool).toHaveLength(0);
  });

  it("leaves an item behind when the chips no longer reach it", async () => {
    const table = await makeTable();
    const user = await makeUser(1000);
    const { uniqueId } = await giveItem(user, 1000);
    await buyIn(table._id, user._id, { seat: 0, kp: 100, uniqueIds: [uniqueId] });

    // lost most of it at the table
    await PokerTable.updateOne({ _id: table._id }, { $set: { "seats.0.stack": 400 } });

    const res = await cashOut(table._id, user._id);
    expect(res.items).toEqual([]);
    expect(res.kp).toBe(400);
    expect((await reload(table._id)).pool).toHaveLength(1);
    expect(await User.exists({ _id: user._id, "inventory.uniqueId": uniqueId })).toBeNull();
  });

  // the prize: an item its staker can no longer afford is open to whoever can
  it("lets a winner take an item the loser can no longer cover", async () => {
    const table = await makeTable();
    const loser = await makeUser(10000);
    const winner = await makeUser(10000);
    const { uniqueId } = await giveItem(loser, 1000);

    await buyIn(table._id, loser._id, { seat: 0, kp: 100, uniqueIds: [uniqueId] });
    await buyIn(table._id, winner._id, { seat: 1, kp: 1000 });
    await PokerTable.updateOne(
      { _id: table._id },
      { $set: { "seats.0.stack": 0, "seats.1.stack": 2000 } }
    );

    const options = cashOutOptions(await reload(table._id), winner._id);
    expect(options.open.map((e) => e.uniqueId)).toEqual([uniqueId]);

    const res = await cashOut(table._id, winner._id, [uniqueId]);
    expect(res.items.map((e) => e.uniqueId)).toEqual([uniqueId]);
    expect(res.kp).toBe(1250);
    expect(await User.exists({ _id: winner._id, "inventory.uniqueId": uniqueId })).toBeTruthy();
  });

  it("refuses to hand over an item its staker can still afford", async () => {
    const table = await makeTable();
    const holder = await makeUser(10000);
    const other = await makeUser(10000);
    const { uniqueId } = await giveItem(holder, 1000);

    await buyIn(table._id, holder._id, { seat: 0, kp: 100, uniqueIds: [uniqueId] });
    await buyIn(table._id, other._id, { seat: 1, kp: 2000 });

    const res = await cashOut(table._id, other._id, [uniqueId]);
    expect(res.error).toBeTruthy();
    expect((await reload(table._id)).pool).toHaveLength(1);
  });

  it("queues the leave instead of dodging a live hand", async () => {
    const table = await makeTable();
    const user = await makeUser(10000);
    await buyIn(table._id, user._id, { seat: 0, kp: 500 });
    await PokerTable.updateOne(
      { _id: table._id },
      { $set: { status: "betting", "seats.0.status": "active" } }
    );

    const res = await cashOut(table._id, user._id);
    expect(res.queued).toBe(true);
    const after = await reload(table._id);
    expect(after.seats[0].leaveAfterHand).toBe(true);
    expect(after.seats[0].status).toBe("active");
    expect((await User.findById(user._id)).walletBalance).toBe(9500);
  });

  it("refuses a cash-out from somebody who is not seated", async () => {
    const table = await makeTable();
    const user = await makeUser(1000);
    expect((await cashOut(table._id, user._id)).error).toBeTruthy();
  });

  it("conserves value across a full round trip", async () => {
    const table = await makeTable();
    const user = await makeUser(1000);
    const { uniqueId } = await giveItem(user, 1000);

    await buyIn(table._id, user._id, { seat: 0, kp: 300, uniqueIds: [uniqueId] });
    await cashOut(table._id, user._id);

    const after = await User.findById(user._id);
    expect(after.walletBalance).toBe(1000);
    expect(after.inventory.filter((e) => e.uniqueId === uniqueId)).toHaveLength(1);
  });
});
