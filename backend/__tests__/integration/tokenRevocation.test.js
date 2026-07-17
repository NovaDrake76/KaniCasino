process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");

let app;
beforeAll(async () => { await setupDb(); app = makeApp(); });
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = () => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance: 100 });
};

const tokenFor = (user, tokenVersion) =>
  jwt.sign({ userId: user._id.toString(), tokenVersion }, process.env.JWT_SECRET, { expiresIn: "30d" });

const bearer = (t) => ["Authorization", `Bearer ${t}`];

test("a token matching the account version is accepted", async () => {
  const user = await makeUser();
  const res = await request(app).get("/users/me").set(...bearer(tokenFor(user, 0)));
  expect(res.status).toBe(200);
});

test("logout-all revokes every existing token", async () => {
  const user = await makeUser();
  const token = tokenFor(user, 0);

  // the token works, then the user signs out of all devices
  expect((await request(app).get("/users/me").set(...bearer(token))).status).toBe(200);
  const out = await request(app).post("/users/logout-all").set(...bearer(token));
  expect(out.status).toBe(200);

  // the same token is now rejected
  const after = await request(app).get("/users/me").set(...bearer(token));
  expect(after.status).toBe(401);

  // a freshly issued token (next version) works again
  const fresh = tokenFor(user, 1);
  expect((await request(app).get("/users/me").set(...bearer(fresh))).status).toBe(200);
});

test("a legacy token with no version keeps working until the first revoke", async () => {
  const user = await makeUser();
  // a token issued before token versions existed carries no tokenVersion claim
  const legacy = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "30d" });

  expect((await request(app).get("/users/me").set(...bearer(legacy))).status).toBe(200);

  await request(app).post("/users/logout-all").set(...bearer(legacy));
  expect((await request(app).get("/users/me").set(...bearer(legacy))).status).toBe(401);
});
