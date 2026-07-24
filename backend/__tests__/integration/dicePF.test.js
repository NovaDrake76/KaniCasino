process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Roll = require("../../models/Roll");
const Seed = require("../../models/Seed");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");

let app;

beforeAll(async () => {
  await setupDb();
  await Promise.all([Seed.syncIndexes(), Roll.syncIndexes()]);
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeUser(walletBalance = 1000) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
}

const rollDice = (auth, body) => request(app).post("/games/dice").set(auth).send(body);

test("a roll charges the bet, settles the outcome, and records a dice roll", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const res = await rollDice(auth, { betAmount: 100, target: 5050, direction: "over" });
  expect(res.status).toBe(200);
  expect(res.body.rollId).toMatch(/^R\d+$/);
  expect(res.body.result).toBeGreaterThanOrEqual(0);
  expect(res.body.result).toBeLessThanOrEqual(9999);
  expect(res.body.multiplier).toBe(2); // over 50.50 -> 49.5% -> 2.0000x
  // the result decides win/loss, and the payout follows exactly
  expect(res.body.won).toBe(res.body.result >= 5050);
  expect(res.body.payout).toBe(res.body.won ? 200 : 0);

  const roll = await Roll.findOne({ userId: u._id, game: "dice" });
  expect(roll).toBeTruthy();
  expect(roll.outcome.result).toBe(res.body.result);
  expect(roll.outcome.payout).toBe(res.body.payout);
  expect((await Seed.findOne({ userId: u._id, active: true })).nonce).toBe(1);

  const after = await User.findById(u._id);
  expect(after.walletBalance).toBeCloseTo(1000 - 100 + res.body.payout, 10);

  const bet = await Transaction.findOne({ userId: u._id, type: TX.DICE_BET });
  expect(bet.amount).toBe(100);
  const win = await Transaction.findOne({ userId: u._id, type: TX.DICE_WIN });
  if (res.body.won) expect(win.amount).toBe(200);
  else expect(win).toBeNull();
});

test("an insufficient balance answers 400 and moves no money", async () => {
  const u = await makeUser(5);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const res = await rollDice(auth, { betAmount: 100, target: 5000, direction: "under" });
  expect(res.status).toBe(400);
  expect((await User.findById(u._id)).walletBalance).toBe(5);
  expect(await Roll.findOne({ userId: u._id, game: "dice" })).toBeNull();
});

test("bad inputs are rejected before any money moves", async () => {
  const u = await makeUser(100000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const bad = [
    { betAmount: 10, target: 5000 }, // missing direction
    { betAmount: 10, target: 5000, direction: "sideways" },
    { betAmount: 10, target: 100, direction: "under" }, // winCount 100, under 2%
    { betAmount: 10, target: 9900, direction: "under" }, // over 98%
    { betAmount: 10, target: 0, direction: "over" },
    { betAmount: 10, target: 50.5, direction: "over" }, // not an integer unit
    { betAmount: 10.5, target: 5000, direction: "over" },
    { betAmount: 0, target: 5000, direction: "over" },
    { betAmount: 30000, target: 5000, direction: "over" }, // over the bet cap
    { betAmount: "10", target: 5000, direction: "over" },
  ];
  for (const body of bad) {
    const res = await rollDice(auth, body);
    expect(res.status).toBe(400);
  }
  expect((await User.findById(u._id)).walletBalance).toBe(100000);
  expect(await Roll.findOne({ userId: u._id, game: "dice" })).toBeNull();
});

test("concurrent rolls reserve distinct nonces", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const [a, b] = await Promise.all([
    rollDice(auth, { betAmount: 10, target: 5000, direction: "over" }),
    rollDice(auth, { betAmount: 10, target: 5000, direction: "over" }),
  ]);
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);

  const nonces = (await Roll.find({ userId: u._id, game: "dice" })).map((r) => r.nonce).sort();
  expect(nonces).toEqual([0, 1]);
});

test("a rotated seed lets the verifier reproduce the roll", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const roll = await rollDice(auth, { betAmount: 50, target: 2500, direction: "under" });
  expect(roll.status).toBe(200);

  // still hidden: the active seed must not verify
  const early = await request(app).get(`/fair/roll/${roll.body.rollId}/verify`);
  expect(early.body.ok).toBe(false);

  await request(app).post("/fair/rotate").set(auth).send({});

  const verified = await request(app).get(`/fair/roll/${roll.body.rollId}/verify`);
  expect(verified.body.ok).toBe(true);
  expect(verified.body.commitmentValid).toBe(true);
  expect(verified.body.recomputedResult).toBe(roll.body.resultValue);
  expect(verified.body.recomputedWon).toBe(roll.body.won);
  expect(verified.body.recomputedPayout).toBe(roll.body.payout);
});
