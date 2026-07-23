process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const mongoose = require("mongoose");
const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");
const Case = require("../../models/Case");
const Item = require("../../models/Item");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeCase(price = 50) {
  const s = uniqueSuffix();
  const item = await Item.create({ name: `i-${s}`, image: "i.png", rarity: "3" });
  return Case.create({ title: `c-${s}`, image: "c.png", price, items: [item._id] });
}

const open = (caseDoc, quantity) =>
  Transaction.create({
    userId: new mongoose.Types.ObjectId(),
    type: TX.CASE_OPEN,
    direction: "debit",
    amount: caseDoc.price * quantity,
    balanceAfter: 0,
    meta: { caseId: caseDoc._id, caseTitle: caseDoc.title, quantity },
  });

test("ranks cases by opens and honours the limit", async () => {
  const [a, b, c] = [await makeCase(), await makeCase(), await makeCase()];
  await open(a, 1);
  await open(b, 5);
  await open(b, 3);
  await open(c, 2);

  const res = await request(app).get("/cases/most-opened?limit=2");
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(2);
  expect(res.body[0].title).toBe(b.title);
  expect(res.body[0].opens).toBe(8);
  expect(res.body[1].title).toBe(c.title);
  expect(res.body[1].opens).toBe(2);
});

test("counts a missing quantity as a single open", async () => {
  const c = await makeCase();
  await Transaction.create({
    userId: new mongoose.Types.ObjectId(),
    type: TX.CASE_OPEN,
    direction: "debit",
    amount: c.price,
    balanceAfter: 0,
    meta: { caseId: c._id, caseTitle: c.title },
  });

  const res = await request(app).get("/cases/most-opened");
  expect(res.body[0].opens).toBe(1);
});

test("drops rows whose case no longer exists", async () => {
  const gone = await makeCase();
  const alive = await makeCase();
  await open(gone, 9);
  await open(alive, 1);
  await Case.deleteOne({ _id: gone._id });

  const res = await request(app).get("/cases/most-opened");
  expect(res.body).toHaveLength(1);
  expect(res.body[0].title).toBe(alive.title);
});

test("ships neither items nor the range table", async () => {
  const c = await makeCase();
  await open(c, 1);

  const res = await request(app).get("/cases/most-opened");
  expect(res.body[0].items).toBeUndefined();
  expect(res.body[0].rangeTable).toBeUndefined();
  expect(res.body[0].price).toBe(50);
});

test("is empty when nothing has been opened", async () => {
  await makeCase();
  const res = await request(app).get("/cases/most-opened");
  expect(res.status).toBe(200);
  expect(res.body).toEqual([]);
});

test("does not collide with the /:id route", async () => {
  const c = await makeCase();
  const res = await request(app).get(`/cases/${c._id}`);
  expect(res.status).toBe(200);
  expect(res.body.title).toBe(c.title);
});
