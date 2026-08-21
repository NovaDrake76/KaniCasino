process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Transaction = require("../../models/Transaction");
const PokerTable = require("../../models/PokerTable");
const PokerHand = require("../../models/PokerHand");
const { buyIn, blankSeats } = require("../../games/pokerTable");
const { makeEngine, redactFor, room } = require("../../games/poker");
const { legalActions } = require("../../utils/pokerBetting");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

// a socket.io stand-in that remembers what each viewer was sent, so redaction can be
// asserted from a seat, from an opponent's seat and from a spectator at once
function fakeIo(viewers = []) {
  const sent = [];
  const sockets = viewers.map((userId) => ({
    userId: userId ? String(userId) : null,
    emit: (event, payload) => sent.push({ to: String(userId), event, payload }),
  }));
  return {
    sent,
    to: (name) => ({ emit: (event, payload) => sent.push({ to: name, event, payload }) }),
    in: () => ({ fetchSockets: async () => sockets }),
    emit: (event, payload) => sent.push({ to: "*", event, payload }),
    stateFor: (userId) =>
      sent.filter((m) => m.event === "poker:state" && m.to === String(userId)).slice(-1)[0]?.payload,
    events: (event) => sent.filter((m) => m.event === event).map((m) => m.payload),
  };
}

const makeTable = (over = {}) =>
  PokerTable.create({
    slug: `t-${uniqueSuffix()}`,
    name: "Test",
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

// two seated players with a hand already dealt
async function dealtTable(engine, stacks = [1000, 1000]) {
  const table = await makeTable();
  const users = [];
  for (const [i, kp] of stacks.entries()) {
    const user = await makeUser();
    await buyIn(table._id, user._id, { seat: i, kp });
    users.push(user);
  }
  await engine.startIfReady(table._id);
  return { table: await PokerTable.findById(table._id), users };
}

const load = (id) => PokerTable.findById(id);

// act for whoever is to act, without the test needing to know the seat order
async function actFor(engine, tableId, action) {
  const table = await load(tableId);
  const seat = table.toAct;
  return engine.act(tableId, table.seats[seat].userId, action);
}

describe("dealing", () => {
  it("starts a hand once two players are seated", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);

    expect(table.status).toBe("betting");
    expect(table.street).toBe("preflop");
    expect(table.handNumber).toBe(1);
    expect(table.deck).toHaveLength(52);
    expect(table.seats[0].holeCards).toHaveLength(2);
    expect(table.seats[1].holeCards).toHaveLength(2);
    expect(table.toAct).not.toBeNull();
  });

  it("will not start with one player", async () => {
    const engine = makeEngine(fakeIo());
    const table = await makeTable();
    const user = await makeUser();
    await buyIn(table._id, user._id, { seat: 0, kp: 1000 });

    expect(await engine.startIfReady(table._id)).toBeNull();
    expect((await load(table._id)).status).toBe("idle");
  });

  it("posts the blinds", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    const committed = table.seats.slice(0, 2).map((s) => s.committed).sort((a, b) => a - b);
    expect(committed).toEqual([5, 10]);
  });

  it("commits to the deck before dealing and keeps the seed back", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    expect(table.pfServerSeedHash).toHaveLength(64);
    expect(table.pfServerSeed).toBeTruthy();
    expect(table.pfServerSeedHash).not.toBe(table.pfServerSeed);
  });

  it("gives every seat and the board different cards", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine, [1000, 1000, 1000]);
    const holes = table.seats.slice(0, 3).flatMap((s) => s.holeCards);
    expect(new Set(holes).size).toBe(6);
  });
});

// the one genuinely new problem: every other game broadcasts a public outcome
describe("hidden information", () => {
  it("shows a player their own cards and nobody else's", async () => {
    const engine = makeEngine(fakeIo());
    const { table, users } = await dealtTable(engine);

    const mine = redactFor(table, users[0]._id);
    expect(mine.seats[0].holeCards).toHaveLength(2);
    expect(mine.seats[1].holeCards).toBeNull();

    const theirs = redactFor(table, users[1]._id);
    expect(theirs.seats[1].holeCards).toHaveLength(2);
    expect(theirs.seats[0].holeCards).toBeNull();
  });

  it("shows a spectator nothing at all", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    const watching = redactFor(table, null);
    expect(watching.seats[0].holeCards).toBeNull();
    expect(watching.seats[1].holeCards).toBeNull();
  });

  // the deck determines every hole card, so shipping it is the same as shipping the cards
  it("never ships the deck, to anyone", async () => {
    const engine = makeEngine(fakeIo());
    const { table, users } = await dealtTable(engine);
    for (const viewer of [users[0]._id, users[1]._id, null]) {
      const state = redactFor(table, viewer);
      expect(state.deck).toBeUndefined();
      expect(JSON.stringify(state)).not.toContain('"deck"');
    }
  });

  it("never ships the server seed while the hand is live", async () => {
    const engine = makeEngine(fakeIo());
    const { table, users } = await dealtTable(engine);
    const seed = table.pfServerSeed;
    for (const viewer of [users[0]._id, users[1]._id, null]) {
      expect(JSON.stringify(redactFor(table, viewer))).not.toContain(seed);
    }
  });

  it("redacts every push, not just the ones a test looks at", async () => {
    const io = fakeIo([]);
    const engine = makeEngine(io);
    const { table, users } = await dealtTable(engine);

    const watched = fakeIo([users[0]._id, users[1]._id, null]);
    await engine.pushTable(watched, table);

    const spectator = watched.stateFor(null);
    expect(spectator.seats.every((s) => s.holeCards === null)).toBe(true);
    const seat0 = watched.stateFor(users[0]._id);
    expect(seat0.seats[0].holeCards).toHaveLength(2);
    expect(seat0.seats[1].holeCards).toBeNull();
  });
});

describe("acting", () => {
  it("refuses a player who is not seated", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    const stranger = await makeUser();
    expect((await engine.act(table._id, stranger._id, { type: "fold" })).error).toBeTruthy();
  });

  it("refuses a player acting out of turn", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    const waiting = table.seats[table.toAct === 0 ? 1 : 0].userId;
    expect((await engine.act(table._id, waiting, { type: "fold" })).error).toMatch(/turn/i);
  });

  it("refuses an illegal action", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    const seat = table.toAct;
    const res = await engine.act(table._id, table.seats[seat].userId, { type: "raise", to: 11 });
    expect(res.error).toBeTruthy();
  });

  it("refuses to bet chips a seat does not hold", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine, [1000, 1000]);
    const seat = table.toAct;
    const res = await engine.act(table._id, table.seats[seat].userId, { type: "raise", to: 99999 });
    expect(res.error).toBeTruthy();
    expect((await load(table._id)).seats[seat].stack).toBeGreaterThan(0);
  });

  // two clicks in one tick must not both land
  it("lets only one of two simultaneous actions through", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    const seat = table.toAct;
    const userId = table.seats[seat].userId;

    const results = await Promise.all([
      engine.act(table._id, userId, { type: "call" }),
      engine.act(table._id, userId, { type: "call" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("records the action for the table", async () => {
    const io = fakeIo();
    const engine = makeEngine(io);
    const { table } = await dealtTable(engine);
    await actFor(engine, table._id, { type: "call" });
    expect(io.events("poker:action").slice(-1)[0].action).toBe("call");
  });
});

describe("finishing a hand", () => {
  it("pays the pot to the last player standing when everyone folds", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine, [1000, 1000]);
    const folder = table.toAct;
    const winner = folder === 0 ? 1 : 0;

    await actFor(engine, table._id, { type: "fold" });

    const after = await load(table._id);
    expect(after.status).toBe("showdown");
    expect(after.seats[winner].stack).toBe(1005);
    expect(after.seats[folder].stack).toBe(995);
  });

  it("takes no rake before the flop", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    await actFor(engine, table._id, { type: "fold" });

    const hand = await PokerHand.findOne({ tableId: table._id });
    expect(hand.rake).toBe(0);
    expect(hand.sawFlop).toBe(false);
  });

  it("conserves every chip on the table", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine, [1000, 1000]);

    let guard = 0;
    while ((await load(table._id)).status === "betting" && guard++ < 40) {
      const t = await load(table._id);
      if (t.toAct === null || t.toAct === undefined) {
        await engine.advance(table._id);
        continue;
      }
      const options = legalActions(
        {
          seats: t.seats.map((s) => ({
            stack: s.stack,
            committed: s.committed,
            status: ["active", "folded", "allin"].includes(s.status) ? s.status : "out",
            hasActed: s.hasActed,
            canRaise: s.canRaise,
          })),
          currentBet: t.currentBet,
          minRaise: t.minRaise,
          toAct: t.toAct,
        },
        t.toAct
      );
      const call = options.find((o) => o.type === "call") || options.find((o) => o.type === "check");
      await actFor(engine, table._id, { type: call.type });
    }

    const after = await load(table._id);
    const hand = await PokerHand.findOne({ tableId: table._id });
    const chips = after.seats.reduce((sum, s) => sum + s.stack, 0);
    expect(chips + hand.rake).toBe(2000);
  });

  it("reveals the server seed only once the hand is done", async () => {
    const io = fakeIo();
    const engine = makeEngine(io);
    const { table } = await dealtTable(engine);
    const seed = table.pfServerSeed;

    const before = JSON.stringify(io.events("poker:handStart"));
    expect(before).not.toContain(seed);

    await actFor(engine, table._id, { type: "fold" });
    expect(io.events("poker:showdown")[0].pfServerSeed).toBe(seed);
  });

  it("writes the hand with the hole cards of everyone, folders included", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    const folder = table.toAct;
    await actFor(engine, table._id, { type: "fold" });

    const hand = await PokerHand.findOne({ tableId: table._id });
    expect(hand.players).toHaveLength(2);
    const record = hand.players.find((p) => p.seat === folder);
    expect(record.folded).toBe(true);
    // this is the whole collusion-detection substrate: a dumped hand looks like a folded
    // one, and only the cards tell them apart
    expect(record.holeCards).toHaveLength(2);
    expect(hand.pfServerSeed).toBe(table.pfServerSeed);
    expect(hand.combinedClientSeed).toContain(":");
  });

  it("is reproducible from the revealed seed", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    await actFor(engine, table._id, { type: "fold" });

    const hand = await PokerHand.findOne({ tableId: table._id });
    const { shuffle, deal } = require("../../utils/pokerCards");
    const deck = shuffle(hand.pfServerSeed, hand.combinedClientSeed, hand.handNumber);
    const dealt = deal(deck, 6);
    expect(dealt.holes[hand.players[0].seat]).toEqual(hand.players[0].holeCards);
  });
});

describe("the item cage during a hand", () => {
  it("puts an item on the line when its staker can no longer cover it", async () => {
    const engine = makeEngine(fakeIo());
    const table = await makeTable();
    const staker = await makeUser();
    const other = await makeUser();

    const item = await Item.create({ name: "Reimu", image: "r.png", rarity: "5", baseValue: 1000 });
    const uniqueId = `uq-${uniqueSuffix()}`;
    await User.updateOne(
      { _id: staker._id },
      { $push: { inventory: { _id: item._id, name: item.name, image: item.image, rarity: "5", uniqueId } } }
    );

    await buyIn(table._id, staker._id, { seat: 0, kp: 50, uniqueIds: [uniqueId] });
    await buyIn(table._id, other._id, { seat: 1, kp: 2000 });

    // still safe while the chips cover the 750 sell value
    expect(redactFor(await load(table._id), null).atRisk).toEqual([]);

    await PokerTable.updateOne({ _id: table._id }, { $set: { "seats.0.stack": 300 } });
    const risked = redactFor(await load(table._id), null).atRisk;
    expect(risked).toHaveLength(1);
    expect(risked[0].name).toBe("Reimu");
  });

  it("tells everybody what went on the line, spectators included", async () => {
    const engine = makeEngine(fakeIo());
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
    await buyIn(table._id, other._id, { seat: 1, kp: 800 });

    const state = redactFor(await load(table._id), null);
    expect(state.pool).toHaveLength(1);
    expect(state.pool[0].name).toBe("Flandre");
    expect(state.pool[0].value).toBe(750);
  });
});

describe("rake", () => {
  it("credits the house and books it against the hand", async () => {
    const engine = makeEngine(fakeIo());
    const table = await makeTable();
    const a = await makeUser();
    const b = await makeUser();
    await buyIn(table._id, a._id, { seat: 0, kp: 1000 });
    await buyIn(table._id, b._id, { seat: 1, kp: 1000 });
    await engine.startIfReady(table._id);

    // both all-in preflop, then the board runs out
    await actFor(engine, table._id, { type: "raise", to: 1000 });
    await actFor(engine, table._id, { type: "call" });
    for (let i = 0; i < 5; i++) await engine.advance(table._id);

    const hand = await PokerHand.findOne({ tableId: table._id });
    expect(hand.sawFlop).toBe(true);
    expect(hand.rake).toBe(30); // 5% of 2000 capped at 3 big blinds

    const row = await Transaction.findOne({ type: "poker_rake" });
    expect(row.amount).toBe(30);
    expect(row.direction).toBe("credit");
  });
});

describe("recovery", () => {
  // the deck and both seeds are persisted, so a hand is picked up where it stopped rather
  // than voided: the street it had already paid for still gets dealt
  it("carries on a hand a restart caught between streets", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    await PokerTable.updateOne({ _id: table._id }, { $set: { toAct: null } });

    const recovered = makeEngine(fakeIo());
    expect(await recovered.recover()).toBeGreaterThan(0);

    const after = await load(table._id);
    expect(after.street).toBe("flop");
    expect(after.board).toHaveLength(3);
    expect(after.toAct).not.toBeNull();
  });

  it("deals the same board it would have dealt before the restart", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    const { shuffle, deal } = require("../../utils/pokerCards");
    const expected = deal(shuffle(table.pfServerSeed, table.seats.filter((s) => s.userId).map((s) => s.clientSeed).join(":"), 1), 6).flop;

    await PokerTable.updateOne({ _id: table._id }, { $set: { toAct: null } });
    await makeEngine(fakeIo()).recover();

    expect((await load(table._id)).board).toEqual(expected);
  });

  it("does not leave a settling table stuck", async () => {
    const engine = makeEngine(fakeIo());
    const { table } = await dealtTable(engine);
    await PokerTable.updateOne(
      { _id: table._id },
      { $set: { status: "settling", lockedAt: new Date(Date.now() - 60000) } }
    );

    await makeEngine(fakeIo()).recover();
    expect(["showdown", "idle"]).toContain((await load(table._id)).status);
  });
});
