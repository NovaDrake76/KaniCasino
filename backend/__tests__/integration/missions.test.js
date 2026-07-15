process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
// count all seeded activity regardless of wall clock
process.env.MISSIONS_LAUNCH_AT = "2000-01-01T00:00:00.000Z";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");
const Battle = require("../../models/Battle");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");

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
    walletBalance: 1000,
    ...overrides,
  });
}

function auth(req, user) {
  return req.set("Authorization", `Bearer ${tokenFor(user)}`);
}

async function tx(userId, type, { amount = 1, meta = {}, direction = "debit", createdAt } = {}) {
  const doc = { userId, type, direction, amount, meta };
  if (createdAt) doc.createdAt = createdAt;
  return Transaction.create(doc);
}

function getMissions(user) {
  return auth(request(app).get("/missions"), user);
}
function find(body, key) {
  return body.missions.find((m) => m.key === key);
}

describe("GET /missions", () => {
  test("requires auth", async () => {
    expect((await request(app).get("/missions")).status).toBe(401);
  });

  test("a fresh user has the full catalog with zero progress and nothing claimable", async () => {
    const u = await makeUser();
    const res = await getMissions(u);
    expect(res.status).toBe(200);
    expect(res.body.missions.length).toBeGreaterThanOrEqual(16);
    expect(res.body.missions.every((m) => m.current === 0)).toBe(true);
    expect(res.body.totals.claimable).toBe(0);
    expect(find(res.body, "first-case").complete).toBe(false);
  });

  test("casesOpened sums meta.quantity across case_open rows", async () => {
    const u = await makeUser();
    await tx(u._id, TX.CASE_OPEN, { amount: 300, meta: { quantity: 3 } });
    await tx(u._id, TX.CASE_OPEN, { amount: 200, meta: { quantity: 2 } });
    const res = await getMissions(u);
    expect(find(res.body, "first-case").current).toBe(1); // clamped to target
    expect(find(res.body, "first-case").complete).toBe(true);
    expect(find(res.body, "cases-10").current).toBe(5); // 3 + 2, not yet 10
    expect(find(res.body, "cases-10").complete).toBe(false);
  });

  test("a big single payout completes big-win", async () => {
    const u = await makeUser();
    await tx(u._id, TX.SLOT_WIN, { amount: 12000, direction: "credit" });
    const res = await getMissions(u);
    expect(find(res.body, "big-win").complete).toBe(true);
  });

  test("a small win does not complete big-win", async () => {
    const u = await makeUser();
    await tx(u._id, TX.COINFLIP_WIN, { amount: 500, direction: "credit" });
    const res = await getMissions(u);
    expect(find(res.body, "big-win").complete).toBe(false);
    expect(find(res.body, "coinflip-win").complete).toBe(true);
  });

  test("a finished battle win completes battle-win", async () => {
    const u = await makeUser();
    await Battle.create({
      mode: "1v1",
      entryCost: 100,
      createdBy: u._id,
      status: "finished",
      finishedAt: new Date(),
      winnerUserIds: [u._id],
    });
    const res = await getMissions(u);
    expect(find(res.body, "battle-win").complete).toBe(true);
  });

  test("complete-collection matches the album: a dangling item ref is not a required slot", async () => {
    const u = await makeUser();
    const s = uniqueSuffix();
    const x = await Item.create({ name: `x-${s}`, image: "i", rarity: "1", baseValue: 100 });
    const y = await Item.create({ name: `y-${s}`, image: "i", rarity: "2", baseValue: 200 });
    const ghost = "651111111111111111111111"; // a deleted item still referenced by the case
    const c = await Case.create({ title: `c-${s}`, image: "c", price: 100, items: [x._id, y._id, ghost] });
    // own the two surviving items only
    await User.updateOne(
      { _id: u._id },
      {
        $push: {
          inventory: {
            $each: [
              { _id: x._id, name: x.name, image: x.image, rarity: x.rarity, case: c._id, uniqueId: `u1-${s}` },
              { _id: y._id, name: y.name, image: y.image, rarity: y.rarity, case: c._id, uniqueId: `u2-${s}` },
            ],
          },
        },
      }
    );
    const res = await getMissions(u);
    expect(find(res.body, "complete-collection").complete).toBe(true);
  });

  test("state-based missions read live user fields", async () => {
    const friend = await makeUser();
    const u = await makeUser({ profilePicture: "http://img/x.png", friends: [friend._id] });
    const res = await getMissions(u);
    expect(find(res.body, "set-avatar").complete).toBe(true);
    expect(find(res.body, "add-friend").complete).toBe(true);
  });

  test("only activity at/after the launch timestamp counts", async () => {
    process.env.MISSIONS_LAUNCH_AT = "2026-07-15T00:00:00.000Z";
    const u = await makeUser();
    await tx(u._id, TX.CASE_OPEN, { meta: { quantity: 1 }, createdAt: new Date("2026-07-14T00:00:00Z") });
    let res = await getMissions(u);
    expect(find(res.body, "first-case").complete).toBe(false); // before launch, ignored
    await tx(u._id, TX.CASE_OPEN, { meta: { quantity: 1 }, createdAt: new Date("2026-07-16T00:00:00Z") });
    res = await getMissions(u);
    expect(find(res.body, "first-case").complete).toBe(true);
    process.env.MISSIONS_LAUNCH_AT = "2000-01-01T00:00:00.000Z";
  });
});

describe("POST /missions/:key/claim", () => {
  test("claiming a completed mission credits the reward once and writes a ledger row", async () => {
    const u = await makeUser({ walletBalance: 1000 });
    await tx(u._id, TX.BONUS, { amount: 1000, direction: "credit" });

    const res = await auth(request(app).post("/missions/first-bonus/claim"), u);
    expect(res.status).toBe(200);
    expect(res.body.claimed).toBe(true);
    expect(res.body.reward).toBe(250);
    expect(res.body.walletBalance).toBe(1250);

    const fresh = await User.findById(u._id);
    expect(fresh.walletBalance).toBe(1250);
    const rows = await Transaction.find({ userId: u._id, type: TX.MISSION_REWARD });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(250);
    expect(rows[0].meta.missionKey).toBe("first-bonus");
  });

  test("re-claiming does not double credit", async () => {
    const u = await makeUser({ walletBalance: 1000 });
    await tx(u._id, TX.BONUS, { amount: 1000, direction: "credit" });

    const first = await auth(request(app).post("/missions/first-bonus/claim"), u);
    expect(first.body.claimed).toBe(true);
    const second = await auth(request(app).post("/missions/first-bonus/claim"), u);
    expect(second.body.claimed).toBe(false);
    expect(second.body.alreadyClaimed).toBe(true);

    const fresh = await User.findById(u._id);
    expect(fresh.walletBalance).toBe(1250); // only one reward
    expect(await Transaction.countDocuments({ userId: u._id, type: TX.MISSION_REWARD })).toBe(1);
  });

  test("concurrent claims credit exactly once", async () => {
    const u = await makeUser({ walletBalance: 1000 });
    await tx(u._id, TX.BONUS, { amount: 1000, direction: "credit" });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => auth(request(app).post("/missions/first-bonus/claim"), u))
    );
    const credited = results.filter((r) => r.body.claimed === true);
    expect(credited).toHaveLength(1);

    const fresh = await User.findById(u._id);
    expect(fresh.walletBalance).toBe(1250);
    expect(await Transaction.countDocuments({ userId: u._id, type: TX.MISSION_REWARD })).toBe(1);
  });

  test("claiming an incomplete mission is rejected", async () => {
    const u = await makeUser();
    const res = await auth(request(app).post("/missions/cases-100/claim"), u);
    expect(res.status).toBe(400);
    expect(await Transaction.countDocuments({ userId: u._id, type: TX.MISSION_REWARD })).toBe(0);
  });

  test("unknown mission key -> 404", async () => {
    const u = await makeUser();
    expect((await auth(request(app).post("/missions/not-a-mission/claim"), u)).status).toBe(404);
  });
});

describe("POST /missions/:key/visit (social, honor-system)", () => {
  test("visiting a social link completes it, then it can be claimed", async () => {
    const u = await makeUser({ walletBalance: 500 });
    let res = await getMissions(u);
    expect(find(res.body, "join-discord").complete).toBe(false);

    const visit = await auth(request(app).post("/missions/join-discord/visit"), u);
    expect(visit.status).toBe(200);

    res = await getMissions(u);
    expect(find(res.body, "join-discord").complete).toBe(true);

    const claim = await auth(request(app).post("/missions/join-discord/claim"), u);
    expect(claim.body.claimed).toBe(true);
    expect(claim.body.reward).toBe(150);
    expect((await User.findById(u._id)).walletBalance).toBe(650);
  });

  test("visiting a non-social mission is rejected", async () => {
    const u = await makeUser();
    expect((await auth(request(app).post("/missions/first-case/visit"), u)).status).toBe(400);
  });
});
