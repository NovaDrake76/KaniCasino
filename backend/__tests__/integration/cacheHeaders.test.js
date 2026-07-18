process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");
const Case = require("../../models/Case");
const Item = require("../../models/Item");
const User = require("../../models/User");

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

// the public reads carry no user and change only on an admin edit, so they are cacheable;
// personalised reads must never be, or one user would be served another's data from a cache.
describe("public read cache headers", () => {
  test("GET /cases is cacheable with a short ttl", async () => {
    await Case.create({ title: "Box", image: "b.webp", price: 50, items: [] });
    const res = await request(app).get("/cases");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
  });

  test("GET /cases/:id is cacheable", async () => {
    const c = await Case.create({ title: "Box", image: "b.webp", price: 50, items: [] });
    const res = await request(app).get(`/cases/${c._id}`);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=120");
  });

  test("GET /items is cacheable", async () => {
    await Item.create({ name: "Card", image: "c.webp", rarity: "1" });
    const res = await request(app).get("/items");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=300");
  });

  test("a personalised read is never cached", async () => {
    // the public profile is per-user; it must not carry a public cache-control
    const s = uniqueSuffix();
    const u = await User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x" });
    const res = await request(app).get(`/users/${u._id}`);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBeUndefined();
  });
});
