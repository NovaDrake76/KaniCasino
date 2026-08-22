process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const artProxy = require("../../utils/artProxy");

let app;
let realFetch;

const STEAM = "https://community.akamai.steamstatic.com/economy/image/abc/360fx360f";

beforeAll(async () => {
  await setupDb();
  app = makeApp();
  realFetch = global.fetch;
});
afterEach(async () => {
  global.fetch = realFetch;
  await clearDb();
});
afterAll(teardownDb);

const pixels = Buffer.from("89504e470d0a1a0a", "hex");

const upstream = (over = {}) => {
  const headers = new Map(Object.entries({ "content-type": "image/png", "content-length": String(pixels.length), ...over.headers }));
  return {
    ok: over.ok !== false,
    headers: { get: (k) => headers.get(k.toLowerCase()) ?? null },
    arrayBuffer: async () => (over.body || pixels).buffer.slice(0),
  };
};

async function auth() {
  const s = uniqueSuffix();
  const user = await User.create({ username: `u-${s}`, email: `u-${s}@example.com`, password: "x" });
  return `Bearer ${tokenFor(user)}`;
}

describe("GET /items/art", () => {
  it("serves an allowed image and tells the browser to keep it", async () => {
    global.fetch = jest.fn(async () => upstream());
    const res = await request(app).get("/items/art").query({ url: STEAM }).set("Authorization", await auth());

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^image\/png/);
    expect(res.headers["cache-control"]).toBe(`public, max-age=${artProxy.CACHE_SECONDS}, immutable`);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe(STEAM);
  });

  it("never leaves the allowlist, and never reaches upstream to find out", async () => {
    global.fetch = jest.fn(async () => upstream());
    const auths = await auth();

    for (const url of ["https://example.com/x.png", "http://169.254.169.254/latest/meta-data/", "", undefined]) {
      const res = await request(app).get("/items/art").query(url === undefined ? {} : { url }).set("Authorization", auths);
      expect(res.status).toBe(400);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("wants a session", async () => {
    global.fetch = jest.fn(async () => upstream());
    const res = await request(app).get("/items/art").query({ url: STEAM });

    expect(res.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses what came back if it is not an image, or is too big", async () => {
    const auths = await auth();

    global.fetch = jest.fn(async () => upstream({ headers: { "content-type": "text/html" } }));
    expect((await request(app).get("/items/art").query({ url: STEAM }).set("Authorization", auths)).status).toBe(502);

    global.fetch = jest.fn(async () => upstream({ headers: { "content-length": String(artProxy.MAX_BYTES + 1) } }));
    expect((await request(app).get("/items/art").query({ url: STEAM }).set("Authorization", auths)).status).toBe(502);

    global.fetch = jest.fn(async () => upstream({ ok: false }));
    expect((await request(app).get("/items/art").query({ url: STEAM }).set("Authorization", auths)).status).toBe(502);
  });

  it("answers rather than hangs when the cdn does not", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("timed out");
    });
    const res = await request(app).get("/items/art").query({ url: STEAM }).set("Authorization", await auth());
    expect(res.status).toBe(504);
  });
});
