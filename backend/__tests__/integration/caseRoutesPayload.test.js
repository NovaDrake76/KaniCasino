process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");
const Case = require("../../models/Case");
const Item = require("../../models/Item");
const { recomputeCaseValues } = require("../../utils/itemValue");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeCaseWithConfig() {
  const s = uniqueSuffix();
  const item = await Item.create({ name: `i-${s}`, image: "i.png", rarity: "3", baseValue: 100 });
  const c = await Case.create({ title: `c-${s}`, image: "c.png", price: 50, items: [item._id] });
  await recomputeCaseValues(c._id);
  return c;
}

test("the case listing ships neither items nor the range table", async () => {
  const c = await makeCaseWithConfig();
  expect((await Case.findById(c._id)).rangeTable.length).toBeGreaterThan(0);

  const res = await request(app).get("/cases");
  expect(res.status).toBe(200);
  const row = res.body.find((x) => x.title === c.title);
  expect(row).toBeTruthy();
  expect(row.items).toBeUndefined();
  expect(row.rangeTable).toBeUndefined();
  expect(row.price).toBe(50);
});

test("the case detail keeps its items but drops the range table", async () => {
  const c = await makeCaseWithConfig();
  const res = await request(app).get(`/cases/${c._id}`);
  expect(res.status).toBe(200);
  expect(res.body.items).toHaveLength(1);
  expect(res.body.items[0].name).toMatch(/^i-/);
  expect(res.body.rangeTable).toBeUndefined();
});
