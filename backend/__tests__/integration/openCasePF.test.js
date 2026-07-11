process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");
const CaseConfig = require("../../models/CaseConfig");
const Roll = require("../../models/Roll");
const Seed = require("../../models/Seed");
const { recomputeCaseValues } = require("../../utils/itemValue");
const { pickFromRanges } = require("../../utils/provablyFair");
const { verifyCaseRoll } = require("../../utils/rolls");

let app;

beforeAll(async () => {
  await setupDb();
  await Promise.all([Seed.syncIndexes(), CaseConfig.syncIndexes(), Roll.syncIndexes()]);
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeCase(price = 10) {
  const s = uniqueSuffix();
  const items = await Item.create([
    { name: `i1-${s}`, image: "x", rarity: "1" },
    { name: `i2-${s}`, image: "x", rarity: "3" },
    { name: `i3-${s}`, image: "x", rarity: "5" },
  ]);
  const c = await Case.create({ title: `c-${s}`, image: "x", price, items: items.map((i) => i._id) });
  await recomputeCaseValues(c._id);
  return c;
}
async function makeUser(walletBalance = 1000) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
}

test("recomputeCaseValues materializes and versions the case config", async () => {
  const c = await makeCase(10);
  const fresh = await Case.findById(c._id);
  expect(fresh.configVersion).toBe(1);
  expect(fresh.configHash).toMatch(/^[0-9a-f]{64}$/);
  expect(fresh.rangeTable.length).toBe(3);
  const cfg = await CaseConfig.findOne({ caseId: c._id, configVersion: 1 });
  expect(cfg.configHash).toBe(fresh.configHash);
});

test("openCase item matches the committed range table and records an audit roll", async () => {
  const u = await makeUser(1000);
  const c = await makeCase(10);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const res = await request(app).post(`/games/openCase/${c._id}`).set(auth).send({ quantity: 2 });
  expect(res.status).toBe(200);
  expect(res.body.items).toHaveLength(2);
  expect(res.body.items[0].rollId).toMatch(/^R\d+$/);

  const cfg = await CaseConfig.findOne({ caseId: c._id, configVersion: 1 });
  const rollDocs = await Roll.find({ userId: u._id, game: "case" }).sort({ nonce: 1 });
  expect(rollDocs.map((r) => r.nonce)).toEqual([0, 1]);
  for (const rd of rollDocs) {
    expect(String(pickFromRanges(rd.roll, cfg.rangeTable).itemId)).toBe(String(rd.itemId));
  }
  expect((await Seed.findOne({ userId: u._id, active: true })).nonce).toBe(2);
});

test("a case roll verifies only after its seed is revealed", async () => {
  const u = await makeUser(1000);
  const c = await makeCase(10);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const res = await request(app).post(`/games/openCase/${c._id}`).set(auth).send({ quantity: 1 });
  const rollId = res.body.items[0].rollId;

  expect((await verifyCaseRoll(rollId)).ok).toBe(false); // seed not revealed yet
  await request(app).post("/fair/rotate").set(auth).send({});
  const after = await verifyCaseRoll(rollId);
  expect(after.ok).toBe(true);
  expect(after.recomputedRoll).toBe(after.expectedRoll);
});

test("a case item resolves to its roll by uniqueId (the shield-to-verify flow)", async () => {
  const u = await makeUser(1000);
  const c = await makeCase(10);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const res = await request(app).post(`/games/openCase/${c._id}`).set(auth).send({ quantity: 1 });
  const { uniqueId, rollId } = res.body.items[0];

  const byItem = await request(app).get(`/fair/roll-by-item/${uniqueId}`);
  expect(byItem.status).toBe(200);
  expect(byItem.body.rollId).toBe(rollId);
  expect(byItem.body.itemId).toBeTruthy();
});

test("openCase self-heals a case that has no committed config yet", async () => {
  const u = await makeUser(1000);
  // create a case WITHOUT recomputeCaseValues (simulates a pre-backfill case)
  const s = uniqueSuffix();
  const items = await Item.create([
    { name: `i1-${s}`, image: "x", rarity: "1" },
    { name: `i2-${s}`, image: "x", rarity: "5" },
  ]);
  const c = await Case.create({ title: `c-${s}`, image: "x", price: 10, items: items.map((i) => i._id) });
  expect((await Case.findById(c._id)).configVersion).toBe(0); // no config yet

  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  const res = await request(app).post(`/games/openCase/${c._id}`).set(auth).send({ quantity: 1 });
  expect(res.status).toBe(200);
  const rollId = res.body.items[0].rollId;

  // config was materialized on the fly, and the roll verifies after reveal
  expect(await CaseConfig.countDocuments({ caseId: c._id })).toBeGreaterThan(0);
  await request(app).post("/fair/rotate").set(auth).send({});
  expect((await verifyCaseRoll(rollId)).ok).toBe(true);
});

test("insufficient balance consumes the nonce, awards nothing, records no roll", async () => {
  const u = await makeUser(5); // case costs 10
  const c = await makeCase(10);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const res = await request(app).post(`/games/openCase/${c._id}`).set(auth).send({ quantity: 1 });
  expect(res.status).toBe(400);
  expect((await Seed.findOne({ userId: u._id, active: true })).nonce).toBe(1); // not rolled back
  expect(await Roll.countDocuments({ userId: u._id })).toBe(0);
  const fresh = await User.findById(u._id);
  expect(fresh.inventory).toHaveLength(0);
  expect(fresh.walletBalance).toBe(5);
});
