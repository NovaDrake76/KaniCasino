process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const UsageEvent = require("../../models/UsageEvent");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = () => {
  const s = uniqueSuffix();
  return User.create({ username: `Kaya ${s}`, slug: `kaya-${s}`, email: `k${s}@k.co`, walletBalance: 100, betaFlags: ["daisu"] });
};

const send = (user, body) => {
  const req = request(app).post("/usage").send(body);
  return user ? req.set("Authorization", `Bearer ${tokenFor(user)}`) : req;
};

describe("the usage record", () => {
  it("stores a batch against the account the token names, never one the body claims", async () => {
    const user = await makeUser();
    const other = await makeUser();

    const res = await send(user, {
      sid: "tab1",
      userId: String(other._id),
      events: [
        { name: "daisu_open", params: { via: "bubble", showing: "jar", attention: false }, path: "/", ago: 2000 },
        { name: "daisu_room", params: { via: "card_missions", from: "popup" }, path: "/", ago: 1000 },
      ],
    });

    expect(res.status).toBe(204);
    const rows = await UsageEvent.find({}).sort({ at: 1 }).lean();
    expect(rows.map((r) => [String(r.userId), r.name, r.params.via, r.sid])).toEqual([
      [String(user._id), "daisu_open", "bubble", "tab1"],
      [String(user._id), "daisu_room", "card_missions", "tab1"],
    ]);
    expect(Date.now() - rows[0].at.getTime()).toBeGreaterThanOrEqual(2000);
  });

  it("answers the same to a batch with nothing it may keep, and keeps nothing", async () => {
    const user = await makeUser();

    const res = await send(user, { events: [{ name: "drop_table", params: { x: 1 } }] });

    expect(res.status).toBe(204);
    expect(await UsageEvent.countDocuments()).toBe(0);
  });

  it("keeps a known event whose params were all dropped, with an empty params rather than none", async () => {
    const user = await makeUser();

    await send(user, { events: [{ name: "tour_step", params: { bogus: 1 } }] });

    const [row] = await UsageEvent.find({}).lean();
    expect(row).toMatchObject({ name: "tour_step", params: {} });
  });

  it("takes nothing from a visitor who is not signed in", async () => {
    const res = await send(null, { events: [{ name: "tour_step", params: { step: "pot" } }] });

    expect(res.status).toBe(401);
    expect(await UsageEvent.countDocuments()).toBe(0);
  });
});
