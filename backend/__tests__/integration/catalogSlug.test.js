process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");

const Case = require("../../models/Case");
const Item = require("../../models/Item");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const makeCase = (title, slug) =>
  Case.create({ title, slug, price: 100, image: "c.png", items: [] });

const makeItem = (name, slug, caseId) =>
  Item.create({ name, slug, rarity: "1", image: "i.png", baseValue: 10, case: caseId });

describe("a case addressed by slug", () => {
  it("resolves by slug and by id alike", async () => {
    const box = await makeCase(`Lunatic ${uniqueSuffix()}`, "lunatic-case");

    const bySlug = await request(app).get("/cases/lunatic-case");
    const byId = await request(app).get(`/cases/${box._id}`);

    expect(bySlug.status).toBe(200);
    expect(String(bySlug.body._id)).toBe(String(box._id));
    expect(bySlug.body.slug).toBe("lunatic-case");
    expect(String(byId.body._id)).toBe(String(box._id));
  });

  it("reports nothing for a slug nobody holds", async () => {
    const res = await request(app).get("/cases/no-such-case");
    expect(res.body).toBeNull();
  });
});

describe("an item addressed by slug", () => {
  it("serves its listings by slug, and says which item it is", async () => {
    const box = await makeCase(`Box ${uniqueSuffix()}`, `box-${uniqueSuffix()}`);
    const item = await makeItem(`Aya ${uniqueSuffix()}`, "aya", box._id);

    const res = await request(app).get("/marketplace/item/aya");

    expect(res.status).toBe(200);
    expect(String(res.body.itemId)).toBe(String(item._id));
    expect(res.body.slug).toBe("aya");
  });

  it("still serves them by id", async () => {
    const box = await makeCase(`Box ${uniqueSuffix()}`, `box-${uniqueSuffix()}`);
    const item = await makeItem(`Aya ${uniqueSuffix()}`, "aya", box._id);

    const res = await request(app).get(`/marketplace/item/${item._id}`);

    expect(res.status).toBe(200);
    expect(String(res.body.itemId)).toBe(String(item._id));
    expect(res.body.slug).toBe("aya");
  });

  it("serves the price history and the order book by slug too", async () => {
    const box = await makeCase(`Box ${uniqueSuffix()}`, `box-${uniqueSuffix()}`);
    await makeItem(`Aya ${uniqueSuffix()}`, "aya", box._id);

    expect((await request(app).get("/marketplace/item/aya/history")).status).toBe(200);
    expect((await request(app).get("/marketplace/item/aya/orders")).status).toBe(200);
  });

  it("404s a slug nobody holds instead of throwing", async () => {
    expect((await request(app).get("/marketplace/item/no-such-item")).status).toBe(404);
    expect((await request(app).get("/marketplace/item/no-such-item/history")).status).toBe(404);
    expect((await request(app).get("/marketplace/item/no-such-item/orders")).status).toBe(404);
  });

  // the index is unique and sparse, so anything without a slug must still coexist
  it("lets any number of items hold no slug", async () => {
    await Item.init();
    const box = await makeCase(`Box ${uniqueSuffix()}`, `box-${uniqueSuffix()}`);
    await makeItem("One", undefined, box._id);
    await makeItem("Two", undefined, box._id);
    expect(await Item.countDocuments({ slug: { $exists: false } })).toBe(2);
  });
});
