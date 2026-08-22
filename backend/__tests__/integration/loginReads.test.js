process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const bcrypt = require("bcryptjs");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const stack = (n) =>
  Array.from({ length: n }, (_, i) => ({ _id: undefined, uniqueId: `u-${i}`, name: "x", rarity: "1" }));

async function makeUser(password, extra = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: await bcrypt.hash(password, 10),
    inventory: stack(40),
    ...extra,
  });
}

// login and the register duplicate checks read whole accounts, inventory included, which
// for the deepest player was 21 seconds before a byte of it was used
describe("logging in", () => {
  it("signs in and hands back a token", async () => {
    const user = await makeUser("hunter2");
    const res = await request(app).post("/users/login").send({ email: user.email, password: "hunter2" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("still refuses a wrong password, an unknown email and a disabled account", async () => {
    const user = await makeUser("hunter2");
    expect((await request(app).post("/users/login").send({ email: user.email, password: "nope" })).status).toBe(400);
    expect((await request(app).post("/users/login").send({ email: "nobody@example.com", password: "x" })).status).toBe(400);

    const off = await makeUser("hunter2", { disabled: true });
    const blocked = await request(app).post("/users/login").send({ email: off.email, password: "hunter2" });
    expect(blocked.status).toBe(403);
  });

  it("carries the token version, so a revoked session still fails", async () => {
    const user = await makeUser("hunter2", { tokenVersion: 3 });
    const res = await request(app).post("/users/login").send({ email: user.email, password: "hunter2" });
    expect(res.status).toBe(200);

    await User.updateOne({ _id: user._id }, { $set: { tokenVersion: 4 } });
    const stale = await request(app).get("/users/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(stale.status).toBe(401);
  });
});

describe("registering", () => {
  it("still refuses a taken email and a taken username", async () => {
    const user = await makeUser("hunter2");

    const email = await request(app)
      .post("/users/register")
      .send({ username: `other-${uniqueSuffix()}`, email: user.email, password: "hunter2" });
    expect(email.status).toBe(400);

    const name = await request(app)
      .post("/users/register")
      .send({ username: user.username, email: `other-${uniqueSuffix()}@example.com`, password: "hunter2" });
    expect(name.status).toBe(400);
  });
});
