process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const MissionState = require("../../models/MissionState");
const { TX } = require("../../utils/economy");

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
    username: `Rin ${s}`,
    slug: `rin-${s}`,
    email: `r${s}@k.co`,
    walletBalance: 1000,
    betaFlags: ["daisu"],
    ...fields,
  });
};

const as = (user, req) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const roadmapOf = (user) => as(user, request(app).get("/daisu/missions"));
const claim = (user, key) => as(user, request(app).post(`/daisu/missions/${key}/claim`));
const visit = (user, goal) => as(user, request(app).post("/daisu/missions/visit").send({ goal }));
const pending = async (user) => (await as(user, request(app).get("/missions/pending?light=1"))).body.pending.filter((p) => p.roadmap);
const row = (userId, type, { amount = 10, meta = {}, direction = "debit", createdAt } = {}) =>
  Transaction.create({ userId, type, amount, meta, direction, ...(createdAt ? { createdAt } : {}) });
const mission = (body, key) => body.missions.find((m) => m.key === key);

// puts a chapter in front of a player as if it had opened this long ago
const openChapter = (user, chapter, { msAgo = 60000, claimed = [] } = {}) =>
  MissionState.updateOne(
    { userId: user._id },
    { $set: { "roadmap.chapter": chapter, "roadmap.openedAt": new Date(Date.now() - msAgo), "roadmap.claimed": claimed } },
    { upsert: true }
  );

describe("daisu's missions", () => {
  it("opens chapter one the first time they are asked for, with the next chapter to look forward to", async () => {
    const user = await makeUser();

    const res = await roadmapOf(user);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ chapter: 1, chapters: 5, finished: false, bonus: 1000 });
    expect(res.body.missions.map((m) => m.key)).toEqual(["r1-full-pot", "r1-pin", "r1-bonus", "r1-level"]);
    expect(res.body.next.chapter).toBe(2);
    expect(res.body.next.missions).toHaveLength(4);
  });

  it("counts activity only from when the chapter opened", async () => {
    const user = await makeUser();
    await openChapter(user, 1);
    await row(user._id, TX.BONUS, { direction: "credit", meta: { fill: 1 }, createdAt: new Date(Date.now() - 120000) });
    await row(user._id, TX.BONUS, { direction: "credit", meta: { fill: 0.6 } });
    expect(mission((await roadmapOf(user)).body, "r1-full-pot").complete).toBe(false);

    await row(user._id, TX.BONUS, { direction: "credit", meta: { fill: 1 } });

    expect(mission((await roadmapOf(user)).body, "r1-full-pot").complete).toBe(true);
  });

  it("reads a state goal off the account as it stands, however long ago it was reached", async () => {
    const user = await makeUser({ level: 7, fixedItem: { name: "Sakuya" } });

    const body = (await roadmapOf(user)).body;

    expect(mission(body, "r1-level")).toMatchObject({ current: 5, complete: true, claimable: true });
    expect(mission(body, "r1-pin").complete).toBe(true);
    expect(mission(body, "r1-bonus")).toMatchObject({ current: 0, complete: false });
  });

  it("counts each ledger goal the way its mission reads it", async () => {
    const user = await makeUser();
    await openChapter(user, 2);
    await row(user._id, TX.DICE_BET);
    await row(user._id, TX.DICE_BET);
    await row(user._id, TX.SLOT_BET);
    await row(user._id, TX.ITEM_SELL, { direction: "credit", meta: { count: 3 } });
    const two = (await roadmapOf(user)).body;
    expect(mission(two, "r2-games")).toMatchObject({ current: 2, complete: false });
    expect(mission(two, "r2-sell").complete).toBe(true);

    await openChapter(user, 3);
    await row(user._id, TX.CASE_OPEN, { amount: 100, meta: { quantity: 5 } });
    await row(user._id, TX.MARKET_BUY, { amount: 50 });
    const three = (await roadmapOf(user)).body;
    expect(mission(three, "r3-cases").current).toBe(5);
    expect(mission(three, "r3-market").complete).toBe(true);

    await openChapter(user, 1);
    await row(user._id, TX.DICE_BET, { amount: 20, meta: { credit: 12.5 } });
    expect(mission((await roadmapOf(user)).body, "r1-bonus").complete).toBe(true);
  });

  it("pays a claim once into the ledger, and refuses one not done or not in the open chapter", async () => {
    const user = await makeUser({ level: 5 });

    const first = await claim(user, "r1-level");

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ claimed: true, reward: 500, walletBalance: 1500, chapterDone: null });
    expect((await claim(user, "r1-level")).body).toMatchObject({ claimed: false, alreadyClaimed: true });
    expect((await claim(user, "r1-pin")).status).toBe(400);
    expect((await claim(user, "r2-gift")).status).toBe(404);
    const rows = await Transaction.find({ userId: user._id, type: TX.MISSION_REWARD }).lean();
    expect(rows.map((r) => r.amount)).toEqual([500]);
  });

  it("closes a chapter on its fourth claim: pays the bonus and opens the next from scratch", async () => {
    const user = await makeUser({ level: 5, fixedItem: { name: "Sakuya" } });
    await openChapter(user, 1, { claimed: ["r1-full-pot", "r1-bonus"] });
    await claim(user, "r1-pin");

    const last = await claim(user, "r1-level");

    expect(last.body.chapterDone).toEqual({ chapter: 1, bonus: 1000 });
    expect(last.body.walletBalance).toBe(1000 + 300 + 500 + 1000);
    expect(last.body.roadmap).toMatchObject({ chapter: 2, bonus: 2000 });
    expect(last.body.roadmap.missions.every((m) => !m.claimed)).toBe(true);
  });

  it("pays a chapter's bonus once when its last two claims land together", async () => {
    const user = await makeUser({ level: 5, fixedItem: { name: "Sakuya" } });
    await openChapter(user, 1, { claimed: ["r1-full-pot", "r1-bonus"] });

    await Promise.all([claim(user, "r1-pin"), claim(user, "r1-level")]);

    expect(await Transaction.countDocuments({ userId: user._id, type: TX.MISSION_REWARD, "meta.chapterBonus": true })).toBe(1);
    expect((await User.findById(user._id).lean()).walletBalance).toBe(1000 + 300 + 500 + 1000);
  });

  it("records a look through a collection only for the open chapter's visit mission", async () => {
    const user = await makeUser();
    expect((await visit(user, "collectionVisits")).body.recorded).toBe(false);

    await openChapter(user, 3);

    expect((await visit(user, "collectionVisits")).body.recorded).toBe(true);
    expect(mission((await roadmapOf(user)).body, "r3-collection").complete).toBe(true);
    expect((await visit(user, "level")).status).toBe(400);
  });

  it("says nothing about what was done when a chapter opened, then announces the next completion once", async () => {
    const user = await makeUser({ level: 9 });
    expect(await pending(user)).toEqual([]);

    await row(user._id, TX.BONUS, { direction: "credit", meta: { fill: 1 } });

    expect(await pending(user)).toEqual([{ key: "r1-full-pot", reward: 250, target: 1, roadmap: true }]);
    expect(await pending(user)).toEqual([]);
  });

  it("has nothing left after the last chapter", async () => {
    const user = await makeUser();
    await openChapter(user, 6);

    expect((await roadmapOf(user)).body).toMatchObject({ chapter: 6, finished: true, missions: [], next: null });
  });

  it("stays behind the beta flag", async () => {
    const outsider = await makeUser({ betaFlags: [] });

    expect((await roadmapOf(outsider)).status).toBe(403);
    expect(await pending(outsider)).toEqual([]);
  });
});
