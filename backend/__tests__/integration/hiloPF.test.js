process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Roll = require("../../models/Roll");
const Seed = require("../../models/Seed");
const Transaction = require("../../models/Transaction");
const HiloGame = require("../../models/HiloGame");
const { TX } = require("../../utils/economy");
const { rankOf, hiChance, loChance } = require("../../utils/hiloMath");

let app;

beforeAll(async () => {
  await setupDb();
  await Promise.all([Seed.syncIndexes(), Roll.syncIndexes(), HiloGame.syncIndexes()]);
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeUser(walletBalance = 1000) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
}

const auth = (u) => ({ Authorization: `Bearer ${tokenFor(u)}` });
// the safe direction for the current card: the side with the higher win chance
const safeDir = (card) => (hiChance(rankOf(card)) >= loChance(rankOf(card)) ? "hi" : "lo");

test("start charges the bet and deals the first card without exposing the deck", async () => {
  const u = await makeUser(1000);
  const h = auth(u);
  const res = await request(app).post("/games/hilo/start").set(h).send({ betAmount: 100 });
  expect(res.status).toBe(200);
  expect(res.body.current).toBeGreaterThanOrEqual(0);
  expect(res.body.current).toBeLessThan(52);
  expect(res.body.multiplier).toBe(1);
  expect(res.body.canCashout).toBe(false);
  expect(res.body.hiMultiplier).toBeGreaterThan(0);
  expect((await User.findById(u._id)).walletBalance).toBe(900);

  const bet = await Transaction.findOne({ userId: u._id, type: TX.HILO_BET });
  expect(bet.amount).toBe(100);
});

test("a correct guess raises the multiplier and lets you cash out", async () => {
  const u = await makeUser(1000);
  const h = auth(u);
  const start = await request(app).post("/games/hilo/start").set(h).send({ betAmount: 100 });
  const dir = safeDir(start.body.current);

  const guess = await request(app).post("/games/hilo/guess").set(h).send({ direction: dir });
  expect(guess.status).toBe(200);
  // the safe side wins the vast majority of the time; if it lost, the game busted
  if (guess.body.status === "active") {
    expect(guess.body.guesses).toBe(1);
    expect(guess.body.multiplier).toBeGreaterThan(0);
    expect(guess.body.canCashout).toBe(true);

    const cash = await request(app).post("/games/hilo/cashout").set(h).send({});
    expect(cash.body.status).toBe("cashed");
    expect(cash.body.payout).toBeCloseTo(Math.round(100 * guess.body.multiplier * 100) / 100, 6);
    const win = await Transaction.findOne({ userId: u._id, type: TX.HILO_WIN });
    expect(win.amount).toBeCloseTo(cash.body.payout, 6);
    expect(await Roll.findOne({ userId: u._id, game: "hilo" })).toBeTruthy();
  } else {
    expect(guess.body.status).toBe("busted");
    expect(guess.body.payout).toBe(0);
  }
});

test("skipping draws a new card without changing the multiplier or charging", async () => {
  const u = await makeUser(1000);
  const h = auth(u);
  await request(app).post("/games/hilo/start").set(h).send({ betAmount: 100 });

  const skip = await request(app).post("/games/hilo/skip").set(h).send({});
  expect(skip.status).toBe(200);
  expect(skip.body.skips).toBe(1);
  expect(skip.body.multiplier).toBe(1);
  expect(skip.body.guesses).toBe(0);
  expect((await User.findById(u._id)).walletBalance).toBe(900); // no extra charge
});

test("cashing out before any guess is refused", async () => {
  const u = await makeUser(1000);
  const h = auth(u);
  await request(app).post("/games/hilo/start").set(h).send({ betAmount: 100 });
  const cash = await request(app).post("/games/hilo/cashout").set(h).send({});
  expect(cash.status).toBe(400);
  expect((await HiloGame.findOne({ userId: u._id })).status).toBe("active");
});

test("only one active game per user, and bad inputs are refused", async () => {
  const u = await makeUser(1000);
  const h = auth(u);
  await request(app).post("/games/hilo/start").set(h).send({ betAmount: 100 });
  const second = await request(app).post("/games/hilo/start").set(h).send({ betAmount: 100 });
  expect(second.status).toBe(409);
  // bad direction is rejected
  const bad = await request(app).post("/games/hilo/guess").set(h).send({ direction: "sideways" });
  expect(bad.status).toBe(400);

  const b = await makeUser(1000);
  const hb = auth(b);
  for (const body of [{ betAmount: 0 }, { betAmount: 20000 }, { betAmount: 5.5 }]) {
    expect((await request(app).post("/games/hilo/start").set(hb).send(body)).status).toBe(400);
  }
  expect((await User.findById(b._id)).walletBalance).toBe(1000);
});

test("a rotated seed lets the verifier reproduce the game", async () => {
  const u = await makeUser(1000);
  const h = auth(u);
  const start = await request(app).post("/games/hilo/start").set(h).send({ betAmount: 50 });
  await request(app).post("/games/hilo/skip").set(h).send({});
  const g = await HiloGame.findOne({ userId: u._id });
  const dir = safeDir(g.cards[g.cards.length - 1]);
  const guess = await request(app).post("/games/hilo/guess").set(h).send({ direction: dir });
  // end the game either way (cash out if still alive)
  let rollId = guess.body.rollId;
  if (guess.body.status === "active") {
    const cash = await request(app).post("/games/hilo/cashout").set(h).send({});
    rollId = cash.body.rollId;
  }
  expect(rollId).toMatch(/^R\d+$/);

  const early = await request(app).get(`/fair/roll/${rollId}/verify`);
  expect(early.body.ok).toBe(false); // seed still hidden

  await request(app).post("/fair/rotate").set(h).send({});
  const verified = await request(app).get(`/fair/roll/${rollId}/verify`);
  expect(verified.body.ok).toBe(true);
  expect(verified.body.commitmentValid).toBe(true);
  expect(verified.body.recomputedPayout).toBe((await HiloGame.findOne({ userId: u._id }).lean()).payout);
});
