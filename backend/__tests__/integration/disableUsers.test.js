process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const bcrypt = require("bcryptjs");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const { disable } = require("../../scripts/disableUsers");

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeUser(over = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `u-${s}`,
    email: `u-${s}@e.com`,
    password: await bcrypt.hash("secret1", 10),
    walletBalance: 500,
    ...over,
  });
}

describe("disabling", () => {
  it("sets the flag, the reason and the time", async () => {
    const user = await makeUser();
    await disable([String(user._id)], { reason: "slur in username" });

    const after = await User.findById(user._id);
    expect(after.disabled).toBe(true);
    expect(after.disabledReason).toBe("slur in username");
    expect(after.disabledAt).toBeInstanceOf(Date);
  });

  // thirty day tokens are already out there; the version bump is what makes it immediate
  it("kills the tokens already issued", async () => {
    const user = await makeUser();
    const before = user.tokenVersion || 0;
    await disable([String(user._id)]);
    expect((await User.findById(user._id)).tokenVersion).toBe(before + 1);
  });

  it("keeps the account and everything it owns", async () => {
    const user = await makeUser({ walletBalance: 1234 });
    await disable([String(user._id)]);

    const after = await User.findById(user._id);
    expect(after).toBeTruthy();
    expect(after.walletBalance).toBe(1234);
    expect(after.username).toBe(user.username);
  });

  it("changes nothing on a dry run", async () => {
    const user = await makeUser();
    const rows = await disable([String(user._id)], { dry: true });
    expect(rows[0].result).toMatch(/would disable/);
    expect((await User.findById(user._id)).disabled).toBe(false);
  });

  it("is reversible", async () => {
    const user = await makeUser();
    await disable([String(user._id)], { reason: "mistake" });
    await disable([String(user._id)], { undo: true });

    const after = await User.findById(user._id);
    expect(after.disabled).toBe(false);
    expect(after.disabledReason).toBeUndefined();
  });

  it("says so rather than throwing on an id nobody has", async () => {
    const rows = await disable(["6a87e869c9720a4029510000"]);
    expect(rows[0].result).toBe("no such account");
  });
});

describe("what a disabled account can still do", () => {
  it("cannot use a token it already had", async () => {
    const user = await makeUser();
    const token = tokenFor(user);
    expect((await request(app).get("/users/me").set("Authorization", `Bearer ${token}`)).status).toBe(200);

    await disable([String(user._id)]);

    const res = await request(app).get("/users/me").set("Authorization", `Bearer ${token}`);
    // the version bump lands first, so this reads as a dead session
    expect([401, 403]).toContain(res.status);
  });

  // 401 would tell the client to log in again and it would loop; this is the account
  it("is told the account is disabled, not that the session expired", async () => {
    const user = await makeUser();
    await User.updateOne({ _id: user._id }, { $set: { disabled: true } });

    const res = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/disabled/i);
  });

  it("cannot log back in with the right password", async () => {
    const user = await makeUser();
    await disable([String(user._id)]);

    const res = await request(app)
      .post("/users/login")
      .send({ email: user.email, password: "secret1" });
    expect(res.status).toBe(403);
    expect(res.body.token).toBeUndefined();
  });

  it("still shows on a public profile, so boards and history stay whole", async () => {
    const user = await makeUser();
    await disable([String(user._id)]);
    const res = await request(app).get(`/users/${user._id}`);
    expect(res.status).toBe(200);
  });
});
