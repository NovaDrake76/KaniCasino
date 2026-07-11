process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const crypto = require("crypto");
const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Seed = require("../../models/Seed");
const seeds = require("../../utils/seeds");

let app;

beforeAll(async () => {
  await setupDb();
  await Seed.syncIndexes(); // build the partial-unique active-seed index
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function makeUser() {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x" });
}

describe("seed lifecycle", () => {
  test("getOrCreateActiveSeed creates one active seed and is idempotent", async () => {
    const u = await makeUser();
    const a = await seeds.getOrCreateActiveSeed(u._id);
    const b = await seeds.getOrCreateActiveSeed(u._id);
    expect(a._id.toString()).toBe(b._id.toString());
    expect(await Seed.countDocuments({ userId: u._id, active: true })).toBe(1);
    expect(a.serverSeedHash).toBe(sha256(a.serverSeed));
  });

  test("concurrent first use still creates exactly one active seed", async () => {
    const u = await makeUser();
    await Promise.all(Array.from({ length: 6 }, () => seeds.getOrCreateActiveSeed(u._id)));
    expect(await Seed.countDocuments({ userId: u._id, active: true })).toBe(1);
  });

  test("reserveNonces hands out distinct, monotonic nonces (no reuse)", async () => {
    const u = await makeUser();
    const results = await Promise.all(Array.from({ length: 5 }, () => seeds.reserveNonces(u._id, 1)));
    const starts = results.map((r) => r.startNonce).sort((a, b) => a - b);
    expect(starts).toEqual([0, 1, 2, 3, 4]);
    expect((await Seed.findOne({ userId: u._id, active: true })).nonce).toBe(5);
  });

  test("reserveNonces(count) reserves a contiguous block", async () => {
    const u = await makeUser();
    const r = await seeds.reserveNonces(u._id, 3);
    expect(r.startNonce).toBe(0);
    expect((await Seed.findOne({ userId: u._id, active: true })).nonce).toBe(3);
  });

  test("getPublicSeedState never exposes serverSeed", async () => {
    const u = await makeUser();
    const state = await seeds.getPublicSeedState(u._id);
    expect(state.serverSeed).toBeUndefined();
    expect(state.serverSeedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(state.nonce).toBe(0);
  });

  test("rotate reveals the verifiable old seed and resets the nonce", async () => {
    const u = await makeUser();
    const before = await seeds.getOrCreateActiveSeed(u._id);
    await seeds.reserveNonces(u._id, 4);
    const { revealed, current } = await seeds.rotate(u._id);
    expect(revealed.serverSeed).toBe(before.serverSeed);
    expect(sha256(revealed.serverSeed)).toBe(before.serverSeedHash);
    expect(current.serverSeedHash).not.toBe(before.serverSeedHash);
    expect(current.nonce).toBe(0);
    expect(await Seed.countDocuments({ userId: u._id, active: true })).toBe(1);
  });

  test("the seed auto-rotates once it crosses the nonce threshold", async () => {
    const u = await makeUser();
    const first = await seeds.getOrCreateActiveSeed(u._id);

    await seeds.reserveNonces(u._id, seeds.AUTO_ROTATE_NONCE - 1); // -> 999, no rotate yet
    expect((await Seed.findOne({ userId: u._id, active: true }))._id.toString()).toBe(
      first._id.toString()
    );

    await seeds.reserveNonces(u._id, 1); // crosses 1000 -> auto-rotate
    const active = await Seed.findOne({ userId: u._id, active: true });
    expect(active._id.toString()).not.toBe(first._id.toString());
    expect(active.nonce).toBe(0);
    expect((await Seed.findById(first._id)).active).toBe(false); // old one revealed
  });

  test("setClientSeed updates the active seed without resetting the nonce", async () => {
    const u = await makeUser();
    await seeds.reserveNonces(u._id, 2);
    const updated = await seeds.setClientSeed(u._id, "breno");
    expect(updated.clientSeed).toBe("breno");
    expect(updated.nonce).toBe(2);
  });
});

describe("fair routes", () => {
  test("GET /fair/seed returns public state, never serverSeed", async () => {
    const u = await makeUser();
    const res = await request(app).get("/fair/seed").set("Authorization", `Bearer ${tokenFor(u)}`);
    expect(res.status).toBe(200);
    expect(res.body.serverSeed).toBeUndefined();
    expect(res.body.serverSeedHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("POST /fair/client-seed then /fair/rotate reveals the old, verifiable seed", async () => {
    const u = await makeUser();
    const auth = { Authorization: `Bearer ${tokenFor(u)}` };
    const set = await request(app).post("/fair/client-seed").set(auth).send({ clientSeed: "myseed" });
    expect(set.status).toBe(200);
    expect(set.body.clientSeed).toBe("myseed");

    const rot = await request(app).post("/fair/rotate").set(auth).send({});
    expect(rot.status).toBe(200);
    expect(rot.body.revealed.clientSeed).toBe("myseed");
    expect(sha256(rot.body.revealed.serverSeed)).toBe(rot.body.revealed.serverSeedHash);
    expect(rot.body.current.nonce).toBe(0);
  });

  test("POST /fair/client-seed rejects an empty seed", async () => {
    const u = await makeUser();
    const res = await request(app)
      .post("/fair/client-seed")
      .set("Authorization", `Bearer ${tokenFor(u)}`)
      .send({ clientSeed: "" });
    expect(res.status).toBe(400);
  });
});
