process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (fields = {}) => {
  const s = uniqueSuffix();
  return User.create({
    username: `Nova ${s}`,
    slug: `nova-${s}`,
    email: `u${s}@k.co`,
    betaFlags: ["daisu"],
    ...fields,
  });
};

// an id minted this many days ago, which is where an account's signup date lives
const idFrom = (daysAgo, tail) =>
  new mongoose.Types.ObjectId(`${Math.floor((Date.now() - daysAgo * 86400000) / 1000).toString(16)}${tail}`);

const tour = (user, body) => request(app).post("/daisu/tour").set("Authorization", `Bearer ${tokenFor(user)}`).send(body);
const me = (user) => request(app).get("/users/me").set("Authorization", `Bearer ${tokenFor(user)}`);

describe("the first-login tour", () => {
  it("is offered to an account made by registering", async () => {
    const name = `tour${String(Date.now()).slice(-6)}`;

    const res = await request(app).post("/users/register").send({ email: `${name}@k.co`, username: name, password: "secret123" });

    expect(res.status).toBe(200);
    const made = await User.findOne({ email: `${name}@k.co` }).lean();
    expect(made.onboarding.status).toBe("offered");
  });

  it("tells the app where the tour stands, and offers it to an account from before it as a returning player", async () => {
    const fresh = await makeUser({ onboarding: { status: "offered" } });
    const old = await makeUser();

    expect((await me(fresh)).body.onboarding).toEqual({ status: "offered", step: null, returning: false });
    expect((await me(old)).body.onboarding).toEqual({ status: "offered", step: null, returning: true });
  });

  it("greets an offer left untaken for a week as a returning player, and keeps a tour already under way", async () => {
    const late = await makeUser({ _id: idFrom(8, "0000000000000000"), onboarding: { status: "offered" } });
    const started = await makeUser({ _id: idFrom(8, "0000000000000001"), onboarding: { status: "active", step: "case" } });

    expect((await me(late)).body.onboarding).toEqual({ status: "offered", step: null, returning: true });
    expect((await me(started)).body.onboarding).toEqual({ status: "active", step: "case" });
  });

  it("moves from offered through its steps to done, stamping when it started and ended", async () => {
    const user = await makeUser({ onboarding: { status: "offered" } });

    expect((await tour(user, { status: "active", step: "pot" })).status).toBe(200);
    expect((await tour(user, { status: "active", step: "game" })).status).toBe(200);
    expect((await tour(user, { status: "done", step: "done" })).status).toBe(200);

    const after = await User.findById(user._id).lean();
    expect(after.onboarding).toMatchObject({ status: "done", step: "done" });
    expect(after.onboarding.startedAt).toBeTruthy();
    expect(after.onboarding.endedAt).toBeTruthy();
  });

  it("runs once: no restart after a skip or once done, and an account from before it can start it", async () => {
    const skipped = await makeUser({ onboarding: { status: "offered" } });
    expect((await tour(skipped, { status: "skipped" })).status).toBe(200);
    expect((await tour(skipped, { status: "active", step: "pot" })).status).toBe(409);

    const old = await makeUser();
    expect((await tour(old, { status: "active", step: "pot" })).status).toBe(200);

    const finished = await makeUser({ onboarding: { status: "done", step: "done" } });
    expect((await tour(finished, { status: "active", step: "pot" })).status).toBe(409);
  });

  it("knows the dice range step", async () => {
    const user = await makeUser({ onboarding: { status: "active", step: "bet" } });
    expect((await tour(user, { status: "active", step: "range" })).status).toBe(200);
  });

  it("refuses a status or a step it does not know", async () => {
    const user = await makeUser({ onboarding: { status: "offered" } });

    expect((await tour(user, { status: "won" })).status).toBe(400);
    expect((await tour(user, { status: "active", step: "cashier" })).status).toBe(400);
  });

  it("stays behind the beta flag", async () => {
    const outsider = await makeUser({ betaFlags: [], onboarding: { status: "offered" } });

    expect((await tour(outsider, { status: "active", step: "pot" })).status).toBe(403);
  });
});
