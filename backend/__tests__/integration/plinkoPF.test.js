process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Roll = require("../../models/Roll");
const Seed = require("../../models/Seed");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");
const { ROWS, PAYOUTS } = require("../../utils/plinkoMath");

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

test("a drop charges the bet, credits the bin payout, and records a plinko roll", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const res = await request(app).post("/games/plinko").set(auth).send({ betAmount: 100, risk: "medium" });
  expect(res.status).toBe(200);
  expect(res.body.rollId).toMatch(/^R\d+$/);
  expect(res.body.path).toMatch(new RegExp(`^[LR]{${ROWS}}$`));
  expect(res.body.bin).toBe(res.body.path.split("R").length - 1);
  expect(res.body.multiplier).toBe(PAYOUTS.medium[res.body.bin] / 100);
  expect(res.body.payout).toBe((100 * PAYOUTS.medium[res.body.bin]) / 100);

  const roll = await Roll.findOne({ userId: u._id, game: "plinko" });
  expect(roll).toBeTruthy();
  expect(roll.outcome.path).toBe(res.body.path);
  expect(roll.outcome.payout).toBe(res.body.payout);
  expect((await Seed.findOne({ userId: u._id, active: true })).nonce).toBe(1);

  const after = await User.findById(u._id);
  expect(after.walletBalance).toBeCloseTo(1000 - 100 + res.body.payout, 10);

  const bet = await Transaction.findOne({ userId: u._id, type: TX.PLINKO_BET });
  const win = await Transaction.findOne({ userId: u._id, type: TX.PLINKO_WIN });
  expect(bet).toBeTruthy();
  expect(bet.amount).toBe(100);
  expect(win).toBeTruthy();
  expect(win.amount).toBe(res.body.payout);
});

test("an insufficient balance answers 400 and moves no money", async () => {
  const u = await makeUser(5);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const res = await request(app).post("/games/plinko").set(auth).send({ betAmount: 100, risk: "low" });
  expect(res.status).toBe(400);
  expect((await User.findById(u._id)).walletBalance).toBe(5);
  expect(await Roll.findOne({ userId: u._id, game: "plinko" })).toBeNull();
});

test("bad inputs are rejected before any money moves", async () => {
  const u = await makeUser(100000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const bad = [
    { betAmount: 10, risk: "extreme" },
    { betAmount: 10, risk: "constructor" }, // inherited object keys are not risks
    { betAmount: 10, risk: "__proto__" },
    { betAmount: 10, risk: 5 },
    { betAmount: 10 },
    { betAmount: 10.5, risk: "low" },
    { betAmount: 0, risk: "low" },
    { betAmount: -5, risk: "medium" },
    { betAmount: "10", risk: "high" },
    { betAmount: 2000, risk: "high" }, // over the per-risk cap
    { betAmount: 20000, risk: "medium" },
  ];
  for (const body of bad) {
    const res = await request(app).post("/games/plinko").set(auth).send(body);
    expect(res.status).toBe(400);
  }
  expect((await User.findById(u._id)).walletBalance).toBe(100000);
});

test("concurrent drops reserve distinct nonces", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const [a, b] = await Promise.all([
    request(app).post("/games/plinko").set(auth).send({ betAmount: 10, risk: "low" }),
    request(app).post("/games/plinko").set(auth).send({ betAmount: 10, risk: "low" }),
  ]);
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);

  const nonces = (await Roll.find({ userId: u._id, game: "plinko" })).map((r) => r.nonce).sort();
  expect(nonces).toEqual([0, 1]);
});

test("a rotated seed lets the verifier reproduce the drop", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const drop = await request(app).post("/games/plinko").set(auth).send({ betAmount: 50, risk: "high" });
  expect(drop.status).toBe(200);

  // still hidden: the active seed must not verify
  const early = await request(app).get(`/fair/roll/${drop.body.rollId}/verify`);
  expect(early.body.ok).toBe(false);

  await request(app).post("/fair/rotate").set(auth).send({});

  const verified = await request(app).get(`/fair/roll/${drop.body.rollId}/verify`);
  expect(verified.body.ok).toBe(true);
  expect(verified.body.commitmentValid).toBe(true);
  expect(verified.body.recomputedPath).toBe(drop.body.path);
  expect(verified.body.recomputedBin).toBe(drop.body.bin);
  expect(verified.body.recomputedMultiplier).toBe(drop.body.multiplier);
});
