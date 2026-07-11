process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const mongoose = require("mongoose");
const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Item = require("../../models/Item");
const Roll = require("../../models/Roll");
const Seed = require("../../models/Seed");

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

test("slots spin records a slots audit roll and advances the nonce", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const res = await request(app).post("/games/slots").set(auth).send({ betAmount: 10 });
  expect(res.status).toBe(200);
  expect(res.body.rollId).toMatch(/^R\d+$/);
  expect(res.body.gridState).toHaveLength(9);

  const roll = await Roll.findOne({ userId: u._id, game: "slots" });
  expect(roll).toBeTruthy();
  expect(roll.outcome.grid).toEqual(res.body.gridState);
  expect((await Seed.findOne({ userId: u._id, active: true })).nonce).toBe(1);
});

test("upgrade records an upgrade audit roll with the success threshold", async () => {
  const caseId = new mongoose.Types.ObjectId();
  const target = await Item.create({ name: `t-${uniqueSuffix()}`, image: "x", rarity: "3", case: caseId, baseValue: 100 });
  const low = await Item.create({ name: `l-${uniqueSuffix()}`, image: "x", rarity: "1", case: caseId, baseValue: 10 });
  const u = await User.create({
    username: `u-${uniqueSuffix()}`,
    email: `u-${uniqueSuffix()}@e.com`,
    password: "x",
    inventory: [{ _id: low._id, name: low.name, image: low.image, rarity: "1", case: caseId, uniqueId: "uq-1" }],
  });
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const res = await request(app)
    .post("/games/upgrade")
    .set(auth)
    .send({ selectedItemIds: ["uq-1"], targetItemId: target._id.toString() });

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("success");
  expect(res.body.rollId).toMatch(/^R\d+$/);

  const roll = await Roll.findOne({ userId: u._id, game: "upgrade" });
  expect(roll).toBeTruthy();
  expect(roll.outcome).toHaveProperty("successRate");
  expect(roll.outcome.success).toBe(res.body.success);
  expect((await Seed.findOne({ userId: u._id, active: true })).nonce).toBe(1);
});
