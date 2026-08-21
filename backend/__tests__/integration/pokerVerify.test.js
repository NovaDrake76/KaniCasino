process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const PokerTable = require("../../models/PokerTable");
const PokerHand = require("../../models/PokerHand");
const { buyIn, blankSeats } = require("../../games/pokerTable");
const { makeEngine } = require("../../games/poker");

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const io = () => ({
  sent: [],
  to() {
    return { emit: (event, payload) => this.sent.push({ event, payload }) };
  },
  in: () => ({ fetchSockets: async () => [] }),
  emit(event, payload) {
    this.sent.push({ event, payload, global: true });
  },
  events(event) {
    return this.sent.filter((m) => m.event === event).map((m) => m.payload);
  },
});

const makeTable = (over = {}) =>
  PokerTable.create({
    slug: `t-${uniqueSuffix()}`,
    name: "Verify Table",
    seatCount: 6,
    smallBlind: 5,
    bigBlind: 10,
    minBuyIn: 200,
    maxBuyIn: 5000,
    seats: blankSeats(6),
    ...over,
  });

async function makeUser(walletBalance = 100000) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
}

async function dealt(engine, stacks = [1000, 1000]) {
  const table = await makeTable();
  for (const [i, kp] of stacks.entries()) {
    await buyIn(table._id, (await makeUser())._id, { seat: i, kp });
  }
  await engine.startIfReady(table._id);
  return PokerTable.findById(table._id);
}

const actFor = async (engine, tableId, action) => {
  const t = await PokerTable.findById(tableId);
  return engine.act(tableId, t.seats[t.toAct].userId, action);
};

describe("verifying a hand", () => {
  it("gives out only the commitment while the hand is live", async () => {
    const engine = makeEngine(io());
    const table = await dealt(engine);

    const res = await request(app).get(`/fair/poker/${table._id}/1`);
    expect(res.status).toBe(200);
    expect(res.body.revealed).toBe(false);
    expect(res.body.serverSeedHash).toBe(table.pfServerSeedHash);
    // the whole hand falls out of the seed, so it cannot be handed over yet
    expect(res.body.serverSeed).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(table.pfServerSeed);
  });

  it("reproduces every card once the hand is over", async () => {
    const engine = makeEngine(io());
    const table = await dealt(engine);
    await actFor(engine, table._id, { type: "fold" });

    const res = await request(app).get(`/fair/poker/${table._id}/1`);
    expect(res.body.revealed).toBe(true);
    expect(res.body.commitmentValid).toBe(true);
    expect(res.body.boardValid).toBe(true);
    expect(res.body.outcomeValid).toBe(true);
    expect(res.body.players).toHaveLength(2);
    expect(res.body.players.every((p) => p.matches)).toBe(true);
    // named cards, so a person can read it rather than a list of numbers
    expect(res.body.players[0].holeCards[0]).toMatch(/^[2-9TJQKA][shdc]$/);
  });

  it("names the client seed as every seated player's, not one of them", async () => {
    const engine = makeEngine(io());
    const table = await dealt(engine);
    await actFor(engine, table._id, { type: "fold" });

    const res = await request(app).get(`/fair/poker/${table._id}/1`);
    expect(res.body.combinedClientSeed.split(":").length).toBeGreaterThanOrEqual(2);
    for (const seat of table.seats.filter((s) => s.userId)) {
      expect(res.body.combinedClientSeed).toContain(seat.clientSeed);
    }
  });

  // a tampered record has to fail, or "verified" means nothing
  it("says the hand does not reproduce when the record is edited", async () => {
    const engine = makeEngine(io());
    const table = await dealt(engine);
    await actFor(engine, table._id, { type: "fold" });

    await PokerHand.updateOne(
      { tableId: table._id, handNumber: 1 },
      { $set: { "players.0.holeCards": [0, 1] } }
    );

    const res = await request(app).get(`/fair/poker/${table._id}/1`);
    expect(res.body.outcomeValid).toBe(false);
    expect(res.body.players.some((p) => !p.matches)).toBe(true);
  });

  it("catches a seed that does not match its commitment", async () => {
    const engine = makeEngine(io());
    const table = await dealt(engine);
    await actFor(engine, table._id, { type: "fold" });
    await PokerHand.updateOne({ tableId: table._id, handNumber: 1 }, { $set: { pfServerSeedHash: "0".repeat(64) } });

    const res = await request(app).get(`/fair/poker/${table._id}/1`);
    expect(res.body.commitmentValid).toBe(false);
    expect(res.body.outcomeValid).toBe(false);
  });

  it("404s on a table nobody has", async () => {
    const res = await request(app).get("/fair/poker/6a87e869c9720a4029510000/1");
    expect(res.status).toBe(404);
  });

  it("is public: verifying does not need a login", async () => {
    const engine = makeEngine(io());
    const table = await dealt(engine);
    await actFor(engine, table._id, { type: "fold" });
    expect((await request(app).get(`/fair/poker/${table._id}/1`)).status).toBe(200);
  });
});

describe("sitting out", () => {
  it("sits a player out after three timeouts running", async () => {
    const engine = makeEngine(io());
    const table = await dealt(engine);
    const seat = table.toAct;

    await PokerTable.updateOne({ _id: table._id }, { $set: { [`seats.${seat}.autoFolds`]: 2 } });
    // the third one is the timeout that tips them over
    await engine.act(table._id, table.seats[seat].userId, { type: "fold" }, true);
    await engine.finishHand(table._id);

    const after = await PokerTable.findById(table._id);
    expect(after.seats[seat].status).toBe("sittingout");
  });

  it("leaves a player who acted alone", async () => {
    const engine = makeEngine(io());
    const table = await dealt(engine);
    const seat = table.toAct;
    await PokerTable.updateOne({ _id: table._id }, { $set: { [`seats.${seat}.autoFolds`]: 2 } });

    // acting on purpose clears the streak
    await engine.act(table._id, table.seats[seat].userId, { type: "fold" }, false);
    await engine.finishHand(table._id);

    const after = await PokerTable.findById(table._id);
    expect(after.seats[seat].status).toBe("sitting");
    expect(after.seats[seat].autoFolds).toBe(0);
  });

  it("does not deal a sitting-out player back in", async () => {
    const engine = makeEngine(io());
    const table = await dealt(engine);
    await engine.act(table._id, table.seats[table.toAct].userId, { type: "fold" });
    await engine.finishHand(table._id);

    await PokerTable.updateOne({ _id: table._id }, { $set: { "seats.0.status": "sittingout" } });
    expect(await engine.startIfReady(table._id)).toBeNull();
  });
});

describe("the ticker", () => {
  it("tells the whole site when a rare item is on the line", async () => {
    const bus = io();
    const engine = makeEngine(bus);
    const table = await makeTable();
    const staker = await makeUser();
    const other = await makeUser();

    const item = await Item.create({ name: "Flandre", image: "f.png", rarity: "5", baseValue: 1000 });
    const uniqueId = `uq-${uniqueSuffix()}`;
    await User.updateOne(
      { _id: staker._id },
      { $push: { inventory: { _id: item._id, name: item.name, image: item.image, rarity: "5", uniqueId } } }
    );

    await buyIn(table._id, staker._id, { seat: 0, kp: 50, uniqueIds: [uniqueId] });
    await buyIn(table._id, other._id, { seat: 1, kp: 2000 });
    await engine.startIfReady(table._id);

    // the staker shoves everything and loses it, which puts flandre out of their reach
    const t = await PokerTable.findById(table._id);
    const stakerSeat = 0;
    if (t.toAct === stakerSeat) await engine.act(table._id, staker._id, { type: "raise", to: t.seats[0].stack });
    else await engine.act(table._id, other._id, { type: "raise", to: 800 });
    await actFor(engine, table._id, { type: "call" });
    for (let i = 0; i < 5; i++) await engine.advance(table._id);

    const after = await PokerTable.findById(table._id);
    const onTheLine = bus.events("poker:onTheLine");
    // it only fires when the item actually went out of reach; if the staker won, it should not
    if (after.seats[0].stack < 750) {
      expect(onTheLine).toHaveLength(1);
      expect(onTheLine[0].item.name).toBe("Flandre");
      expect(onTheLine[0].slug).toBe(after.slug);
    } else {
      expect(onTheLine).toHaveLength(0);
    }
  });

  it("stays quiet about a common item", async () => {
    const bus = io();
    const engine = makeEngine(bus);
    const table = await makeTable();
    const staker = await makeUser();
    const other = await makeUser();

    const item = await Item.create({ name: "Cheap", image: "c.png", rarity: "1", baseValue: 1000 });
    const uniqueId = `uq-${uniqueSuffix()}`;
    await User.updateOne(
      { _id: staker._id },
      { $push: { inventory: { _id: item._id, name: item.name, image: item.image, rarity: "1", uniqueId } } }
    );

    await buyIn(table._id, staker._id, { seat: 0, kp: 50, uniqueIds: [uniqueId] });
    await buyIn(table._id, other._id, { seat: 1, kp: 2000 });
    await engine.startIfReady(table._id);
    await PokerTable.updateOne({ _id: table._id }, { $set: { "seats.0.stack": 0 } });
    await actFor(engine, table._id, { type: "fold" });

    expect(bus.events("poker:onTheLine")).toHaveLength(0);
  });
});
