process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const jwt = require("jsonwebtoken");
const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const { identify } = require("../../middleware/socketAuth");
const { createdAnAccount } = require("../../middleware/rateLimit");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeUser(overrides = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    ...overrides,
  });
}

describe("socket handshake identity", () => {
  it("binds the account behind a live token", async () => {
    const user = await makeUser();
    expect(await identify(tokenFor(user))).toBe(String(user._id));
  });

  it("refuses a token revoked by a logout-everywhere", async () => {
    const user = await makeUser();
    const token = tokenFor(user);
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
    expect(await identify(token)).toBeNull();
  });

  it("accepts a token issued after the revoke", async () => {
    const user = await makeUser({ tokenVersion: 3 });
    const token = jwt.sign(
      { userId: String(user._id), tokenVersion: 3 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    expect(await identify(token)).toBe(String(user._id));
  });

  it("refuses a disabled account", async () => {
    const user = await makeUser({ disabled: true });
    expect(await identify(tokenFor(user))).toBeNull();
  });

  it("refuses a token whose account is gone", async () => {
    const user = await makeUser();
    const token = tokenFor(user);
    await User.deleteOne({ _id: user._id });
    expect(await identify(token)).toBeNull();
  });

  it("connects as a guest with no token, a forged one, or an expired one", async () => {
    const user = await makeUser();
    const expired = jwt.sign({ userId: String(user._id) }, process.env.JWT_SECRET, { expiresIn: -10 });
    expect(await identify(null)).toBeNull();
    expect(await identify("")).toBeNull();
    expect(await identify("not-a-token")).toBeNull();
    expect(await identify(jwt.sign({ userId: String(user._id) }, "wrong-secret"))).toBeNull();
    expect(await identify(expired)).toBeNull();
  });

  it("hangs up the live sockets when a session is revoked", async () => {
    const user = await makeUser();
    const hungUp = [];
    require("../../utils/realtime").setIo({
      in: (room) => ({ disconnectSockets: () => hungUp.push(room) }),
    });

    const res = await request(app)
      .post("/users/logout-all")
      .set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(hungUp).toEqual([String(user._id)]);
    expect((await User.findById(user._id)).tokenVersion).toBe(1);
    require("../../utils/realtime").setIo(null);
  });
});

describe("the register budget", () => {
  it("is spent by a created account and nothing else", () => {
    expect(createdAnAccount({}, { locals: { createdAccount: true } })).toBe(true);
    expect(createdAnAccount({}, { locals: {} })).toBe(false);
    expect(createdAnAccount({}, { locals: { createdAccount: false } })).toBe(false);
  });
});
