process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Roll = require("../../models/Roll");
const Seed = require("../../models/Seed");
const Transaction = require("../../models/Transaction");
const MinesGame = require("../../models/MinesGame");
const { TX } = require("../../utils/economy");
const { TILES, multiplierFor } = require("../../utils/minesMath");

let app;

beforeAll(async () => {
  await setupDb();
  await Promise.all([Seed.syncIndexes(), Roll.syncIndexes(), MinesGame.syncIndexes()]);
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeUser(walletBalance = 1000) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
}

const auth = (u) => ({ Authorization: `Bearer ${tokenFor(u)}` });
const safeTilesOf = (mineSet) => {
  const out = [];
  for (let t = 0; t < TILES; t++) if (!mineSet.includes(t)) out.push(t);
  return out;
};

test("start charges the bet, hides the mines, and one gem raises the multiplier", async () => {
  const u = await makeUser(1000);
  const h = auth(u);

  const start = await request(app).post("/games/mines/start").set(h).send({ betAmount: 100, mineCount: 3 });
  expect(start.status).toBe(200);
  expect(start.body.mineSet).toBeNull(); // never leaks while active
  expect(start.body.multiplier).toBe(1);
  expect(start.body.canCashout).toBe(false);
  expect((await User.findById(u._id)).walletBalance).toBe(900);

  const game = await MinesGame.findOne({ userId: u._id, status: "active" });
  const safe = safeTilesOf(game.mineSet)[0];

  const reveal = await request(app).post("/games/mines/reveal").set(h).send({ tile: safe });
  expect(reveal.status).toBe(200);
  expect(reveal.body.gems).toBe(1);
  expect(reveal.body.multiplier).toBeCloseTo(multiplierFor(3, 1), 8);
  expect(reveal.body.canCashout).toBe(true);
});

test("cashing out pays bet times the multiplier and records a mines roll", async () => {
  const u = await makeUser(1000);
  const h = auth(u);
  await request(app).post("/games/mines/start").set(h).send({ betAmount: 100, mineCount: 3 });
  const game = await MinesGame.findOne({ userId: u._id, status: "active" });
  const [t1, t2] = safeTilesOf(game.mineSet);

  await request(app).post("/games/mines/reveal").set(h).send({ tile: t1 });
  await request(app).post("/games/mines/reveal").set(h).send({ tile: t2 });
  const cash = await request(app).post("/games/mines/cashout").set(h).send({});
  expect(cash.status).toBe(200);
  expect(cash.body.status).toBe("cashed");
  const expected = Math.round(100 * multiplierFor(3, 2) * 100) / 100;
  expect(cash.body.payout).toBeCloseTo(expected, 6);
  expect(cash.body.mineSet).toHaveLength(3); // revealed after the game ends

  const after = await User.findById(u._id);
  expect(after.walletBalance).toBeCloseTo(900 + expected, 6);
  const win = await Transaction.findOne({ userId: u._id, type: TX.MINES_WIN });
  expect(win.amount).toBeCloseTo(expected, 6);
  expect(await Roll.findOne({ userId: u._id, game: "mines" })).toBeTruthy();
});

test("hitting a mine busts the game and pays nothing", async () => {
  const u = await makeUser(1000);
  const h = auth(u);
  await request(app).post("/games/mines/start").set(h).send({ betAmount: 100, mineCount: 5 });
  const game = await MinesGame.findOne({ userId: u._id, status: "active" });

  const bust = await request(app).post("/games/mines/reveal").set(h).send({ tile: game.mineSet[0] });
  expect(bust.status).toBe(200);
  expect(bust.body.status).toBe("busted");
  expect(bust.body.payout).toBe(0);
  expect(bust.body.bustTile).toBe(game.mineSet[0]);
  expect((await User.findById(u._id)).walletBalance).toBe(900); // bet lost, nothing back
  expect(await Transaction.findOne({ userId: u._id, type: TX.MINES_WIN })).toBeNull();
});

test("cashing out before any reveal is refused", async () => {
  const u = await makeUser(1000);
  const h = auth(u);
  await request(app).post("/games/mines/start").set(h).send({ betAmount: 100, mineCount: 3 });
  const cash = await request(app).post("/games/mines/cashout").set(h).send({});
  expect(cash.status).toBe(400);
  expect((await MinesGame.findOne({ userId: u._id })).status).toBe("active");
});

test("only one active game per user, and bad inputs are refused", async () => {
  const u = await makeUser(1000);
  const h = auth(u);
  await request(app).post("/games/mines/start").set(h).send({ betAmount: 100, mineCount: 3 });
  const second = await request(app).post("/games/mines/start").set(h).send({ betAmount: 100, mineCount: 3 });
  expect(second.status).toBe(409);

  const bad = await makeUser(1000);
  const hb = auth(bad);
  for (const body of [
    { betAmount: 100, mineCount: 0 },
    { betAmount: 100, mineCount: 25 },
    { betAmount: 0, mineCount: 3 },
    { betAmount: 20000, mineCount: 3 },
    { betAmount: 10.5, mineCount: 3 },
  ]) {
    expect((await request(app).post("/games/mines/start").set(hb).send(body)).status).toBe(400);
  }
  expect((await User.findById(bad._id)).walletBalance).toBe(1000);
});

test("a rotated seed lets the verifier reproduce the game", async () => {
  const u = await makeUser(1000);
  const h = auth(u);
  await request(app).post("/games/mines/start").set(h).send({ betAmount: 50, mineCount: 4 });
  const game = await MinesGame.findOne({ userId: u._id, status: "active" });
  const [t1] = safeTilesOf(game.mineSet);
  await request(app).post("/games/mines/reveal").set(h).send({ tile: t1 });
  const cash = await request(app).post("/games/mines/cashout").set(h).send({});

  const early = await request(app).get(`/fair/roll/${cash.body.rollId}/verify`);
  expect(early.body.ok).toBe(false); // seed still hidden

  await request(app).post("/fair/rotate").set(h).send({});

  const verified = await request(app).get(`/fair/roll/${cash.body.rollId}/verify`);
  expect(verified.body.ok).toBe(true);
  expect(verified.body.commitmentValid).toBe(true);
  expect(verified.body.recomputedMineSet).toEqual([...game.mineSet].sort((a, b) => a - b));
  expect(verified.body.recomputedPayout).toBe(cash.body.payout);
});
