process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Battle = require("../../models/Battle");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");
const engine = require("../../games/battleEngine");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

const ENTRY = 100;

async function makePlayer(balance) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance: balance });
}

// a battle the process abandoned after claiming it but before the preroll committed:
// in_progress, no server seed, no rolls
async function abandonedBattle(players) {
  return Battle.create({
    status: "in_progress",
    mode: "1v1",
    cases: [new mongoose.Types.ObjectId()],
    entryCost: ENTRY,
    createdBy: players[0]._id,
    players: players.map((p, i) => ({
      userId: p._id, username: p.username, team: i, slot: i, isBot: false,
    })),
    rolls: [],
    currentRound: 0,
    startedAt: new Date(),
  });
}

// the row chargeUser would have written when the entry was actually taken
const recordEntry = (userId, battleId) =>
  Transaction.create({
    userId, type: TX.BATTLE_ENTRY, direction: "debit", amount: ENTRY,
    balanceAfter: 0, meta: { battleId },
  });

test("a battle abandoned before its preroll refunds the players who paid", async () => {
  const a = await makePlayer(900);
  const b = await makePlayer(900);
  const battle = await abandonedBattle([a, b]);
  await recordEntry(a._id, battle._id);
  await recordEntry(b._id, battle._id);

  await engine.completeStuckBattles(undefined, { boot: true });

  const done = await Battle.findById(battle._id);
  // it never happened, so it must not be dressed up as a finished battle
  expect(done.status).toBe("cancelled");
  expect(done.winningTeam).toBeNull();
  expect(done.winnerUserIds).toEqual([]);

  expect((await User.findById(a._id)).walletBalance).toBe(1000);
  expect((await User.findById(b._id)).walletBalance).toBe(1000);
});

test("a player the crash beat to the charge is not refunded money they never paid", async () => {
  const paid = await makePlayer(900);
  const never = await makePlayer(1000);
  const battle = await abandonedBattle([paid, never]);
  await recordEntry(paid._id, battle._id); // only one of them was charged

  await engine.completeStuckBattles(undefined, { boot: true });

  expect((await User.findById(paid._id)).walletBalance).toBe(1000);
  expect((await User.findById(never._id)).walletBalance).toBe(1000); // not 1100
});

test("voiding twice does not pay twice", async () => {
  const a = await makePlayer(900);
  const battle = await abandonedBattle([a]);
  await recordEntry(a._id, battle._id);

  await engine.completeStuckBattles(undefined, { boot: true });
  await engine.completeStuckBattles(undefined, { boot: true });

  expect((await User.findById(a._id)).walletBalance).toBe(1000);
});

test("a battle interrupted mid-reveal still finishes from its preroll", async () => {
  const a = await makePlayer(900);
  const b = await makePlayer(900);
  const battle = await abandonedBattle([a, b]);
  // this one got as far as committing its seed and preroll, so it has a real outcome
  const item = {
    _id: new mongoose.Types.ObjectId(), name: "won", image: "x", rarity: "3",
    case: new mongoose.Types.ObjectId(), baseValue: 500, uniqueId: `w-${uniqueSuffix()}`,
  };
  battle.pfServerSeed = "a".repeat(64);
  battle.pfServerSeedHash = "b".repeat(64);
  battle.rolls = [[item, null]]; // slot 0 won something, slot 1 got nothing
  await battle.save();

  await engine.completeStuckBattles(undefined, { boot: true });

  const done = await Battle.findById(battle._id);
  expect(done.status).toBe("finished");
  expect(done.winningTeam).toBe(0);
  const winner = await User.findById(a._id);
  expect(winner.inventory.map((i) => i.name)).toContain("won");
});

test("the periodic sweep leaves a live in-progress battle for the engine to finish", async () => {
  const a = await makePlayer(900);
  const b = await makePlayer(900);
  const battle = await abandonedBattle([a, b]); // in_progress, the engine is still playing it
  await recordEntry(a._id, battle._id);
  await recordEntry(b._id, battle._id);

  await engine.completeStuckBattles(undefined, { boot: false });

  const same = await Battle.findById(battle._id);
  expect(same.status).toBe("in_progress"); // untouched, no early finish/void
  expect((await User.findById(a._id)).walletBalance).toBe(900); // not refunded out from under it
});
