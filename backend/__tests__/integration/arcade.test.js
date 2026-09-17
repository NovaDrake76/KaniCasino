process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const Case = require("../../models/Case");
const Item = require("../../models/Item");
const HaloDay = require("../../models/HaloDay");
const HaloPlay = require("../../models/HaloPlay");
const HaloStats = require("../../models/HaloStats");
const halo = require("../../utils/halo");
const POOL = require("../../data/haloStudents.json");
const { dayIndex } = require("../../utils/dailyGift");
const { MINT } = require("../../utils/accounts");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
beforeEach(() => halo.resetCaches());
afterEach(clearDb);
afterAll(teardownDb);

const today = () => dayIndex(new Date());
const target = POOL[0];
const misses = POOL.slice(1).map((s) => s.name);

const answerIs = (student = target) => HaloDay.create({ day: today(), name: student.name });

const makeUser = (fields = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `Sensei ${s}`, slug: `sensei-${s}`, email: `s${s}@k.co`, walletBalance: 0, ...fields });
};

const as = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });
const guess = (user, name) => request(app).post("/arcade/daily-halo/guess").set(as(user)).send({ name });
const check = (guesses, ip = "1.1.1.1") =>
  request(app).post("/arcade/daily-halo/check").set("cf-connecting-ip", ip).send({ guesses });

describe("the roster", () => {
  it("lists every student without anything a hint would give away", async () => {
    const res = await request(app).get("/arcade/daily-halo/students");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(POOL.length);
    expect(res.body[0]).not.toHaveProperty("voiceline");
    expect(res.body[0]).not.toHaveProperty("gunImage");
    expect(res.headers["cache-control"]).toMatch(/max-age=3600/);
  });
});

describe("today's student", () => {
  it("is picked on the first view, stored, and the same on every view after", async () => {
    const first = await request(app).get("/arcade/daily-halo/today");
    halo.resetCaches();
    const second = await request(app).get("/arcade/daily-halo/today");

    expect(first.status).toBe(200);
    expect(await HaloDay.countDocuments({ day: today() })).toBe(1);
    const stored = await HaloDay.findOne({ day: today() }).lean();
    expect(halo.studentByName(stored.name)).not.toBeNull();
    expect(second.status).toBe(200);
    expect(await HaloDay.countDocuments({ day: today() })).toBe(1);
  });

  it("never tells a guest who it is", async () => {
    await answerIs();

    const res = await request(app).get("/arcade/daily-halo/today");

    expect(res.body.play).toBeNull();
    expect(res.body.signedIn).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain(target.voiceline);
    expect(new Date(res.body.nextAt).getTime()).toBeGreaterThan(Date.now());
    expect(res.body.maxGuesses).toBe(10);
  });

  it("does not pick a student used in the last two months", async () => {
    const recent = POOL.slice(0, halo.NO_REPEAT_DAYS - 1);
    await HaloDay.insertMany(recent.map((s, i) => ({ day: today() - 1 - i, name: s.name })));
    const recentNames = new Set(recent.map((s) => s.name));

    for (let i = 0; i < 10; i++) {
      halo.resetCaches();
      await HaloDay.deleteOne({ day: today() });
      const name = await halo.nameForDay(today());
      expect(recentNames.has(name)).toBe(false);
    }
  });

  it("shows yesterday's student and how many solved today", async () => {
    await answerIs();
    await HaloDay.create({ day: today() - 1, name: POOL[5].name });

    await check([misses[0], target.name], "2.2.2.2");
    await check([misses[0], misses[1], target.name], "3.3.3.3");
    const res = await request(app).get("/arcade/daily-halo/today");

    expect(res.body.yesterday.name).toBe(POOL[5].name);
    expect(res.body.solves).toBe(2);
    expect(res.body.averageGuesses).toBe(2.5);
  });
});

describe("playing as a guest", () => {
  beforeEach(answerIs);

  it("scores the guesses and opens hints without revealing the answer", async () => {
    const res = await check([misses[0], misses[1]]);

    expect(res.status).toBe(200);
    expect(res.body.play.guesses).toHaveLength(2);
    expect(res.body.play.finished).toBe(false);
    expect(res.body.play.answer).toBeNull();
    expect(res.body.play.hints.filter((h) => h.unlocked).length).toBe(2);
  });

  it("reveals the answer once the game is over, won or lost", async () => {
    const won = await check([misses[0], target.name]);
    expect(won.body.play.won).toBe(true);
    expect(won.body.play.answer.name).toBe(target.name);

    const lost = await check(misses.slice(0, 10), "9.9.9.9");
    expect(lost.body.play.lost).toBe(true);
    expect(lost.body.play.answer.name).toBe(target.name);
  });

  it("counts a finish once per address", async () => {
    await check([target.name], "4.4.4.4");
    await check([target.name], "4.4.4.4");
    await check([target.name], "5.5.5.5");

    expect((await HaloDay.findOne({ day: today() }).lean()).solves).toBe(2);
  });
});

describe("playing signed in", () => {
  beforeEach(answerIs);

  it("pays a win into the wallet through the ledger and records it", async () => {
    const user = await makeUser();

    const first = await guess(user, misses[0]);
    expect(first.body.accepted).toBe(true);
    expect(first.body.play.finished).toBe(false);

    const res = await guess(user, target.name);

    expect(res.body.play.won).toBe(true);
    expect(res.body.play.reward).toBe(930);
    expect(res.body.stats).toMatchObject({ played: 1, wins: 1, currentStreak: 1, bestStreak: 1 });
    expect(res.body.stats.distribution[1]).toBe(1);
    expect((await User.findById(user._id).lean()).walletBalance).toBe(930);

    const [row] = await Transaction.find({ userId: user._id }).lean();
    expect(row.type).toBe("arcade_reward");
    expect(row.amount).toBe(930);
    expect(String(row.counterparty)).toBe(String(MINT));
    expect((await HaloDay.findOne({ day: today() }).lean()).solves).toBe(1);
  });

  it("refuses a guess after the game is over and never pays twice", async () => {
    const user = await makeUser();
    await guess(user, target.name);

    const again = await guess(user, misses[0]);

    expect(again.body.accepted).toBe(false);
    expect(again.body.play.guesses).toHaveLength(1);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(1);
  });

  it("refuses the same name twice, even sent at the same moment", async () => {
    const user = await makeUser();

    await Promise.all([guess(user, misses[0]), guess(user, misses[0])]);

    expect((await HaloPlay.findOne({ userId: user._id }).lean()).guesses).toEqual([misses[0]]);
  });

  it("turns away a name that is not a student", async () => {
    const user = await makeUser();

    const res = await guess(user, "Definitely Not Real");

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("unknown");
  });

  it("ends the game after ten misses with no reward and a broken streak", async () => {
    const user = await makeUser();
    await HaloStats.create({ userId: user._id, currentStreak: 4, bestStreak: 4, lastWonDay: today() - 1 });

    let last;
    for (const name of misses.slice(0, 10)) last = await guess(user, name);
    const eleventh = await guess(user, target.name);

    expect(last.body.play.lost).toBe(true);
    expect(last.body.play.reward).toBe(0);
    expect(last.body.stats.currentStreak).toBe(0);
    expect(last.body.stats.bestStreak).toBe(4);
    expect(eleventh.body.accepted).toBe(false);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(0);
  });

  it("carries a streak from yesterday and pays its bonus", async () => {
    const user = await makeUser();
    await HaloStats.create({ userId: user._id, played: 3, wins: 3, currentStreak: 3, bestStreak: 3, lastWonDay: today() - 1 });

    const res = await guess(user, target.name);

    expect(res.body.stats.currentStreak).toBe(4);
    expect(res.body.stats.bestStreak).toBe(4);
    expect(res.body.play.reward).toBe(halo.rewardFor(1, 4));
  });

  it("shows the game and the record on today's page", async () => {
    const user = await makeUser();
    await HaloStats.create({ userId: user._id, played: 9, wins: 7, currentStreak: 5, bestStreak: 6, lastWonDay: today() - 3 });
    await guess(user, misses[0]);

    const res = await request(app).get("/arcade/daily-halo/today").set(as(user));

    expect(res.body.signedIn).toBe(true);
    expect(res.body.play.guesses).toHaveLength(1);
    expect(res.body.stats.currentStreak).toBe(0);
    expect(res.body.stats.bestStreak).toBe(6);
  });

  it("closes a game whose winning guess landed but whose close did not", async () => {
    const user = await makeUser();
    await HaloPlay.create({ userId: user._id, day: today(), guesses: [misses[0], target.name] });

    const res = await request(app).get("/arcade/daily-halo/today").set(as(user));

    expect(res.body.play.won).toBe(true);
    expect(res.body.play.reward).toBe(930);
    expect((await User.findById(user._id).lean()).walletBalance).toBe(930);
  });

  it("points a finished game at the student's card and case", async () => {
    const box = await Case.create({ title: "Trinity Case", slug: "trinity-case", image: "t.png", price: 500, category: "Blue Archive" });
    await Item.create({ name: target.name, image: "card.png", rarity: "4", case: box._id });
    const user = await makeUser();

    const res = await guess(user, target.name);

    expect(res.body.play.answer.card).toMatchObject({ name: target.name, caseSlug: "trinity-case", caseTitle: "Trinity Case" });
  });
});

describe("carrying a guest game into an account", () => {
  beforeEach(answerIs);

  const adopt = (user, guesses) => request(app).post("/arcade/daily-halo/adopt").set(as(user)).send({ guesses });

  it("keeps a finished game for the record but pays nothing for it", async () => {
    const user = await makeUser();

    const res = await adopt(user, [misses[0], target.name]);

    expect(res.body.adopted).toBe(true);
    expect(res.body.play.won).toBe(true);
    expect(res.body.play.reward).toBe(0);
    expect(res.body.play.adopted).toBe(true);
    expect(res.body.stats.wins).toBe(1);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(0);
  });

  it("happens once, and never over a game the account already has", async () => {
    const user = await makeUser();
    await guess(user, misses[0]);

    const res = await adopt(user, [misses[1], misses[2]]);

    expect(res.body.adopted).toBe(false);
    expect(res.body.play.guesses.map((g) => g.student.name)).toEqual([misses[0]]);
  });

  it("lets an unfinished game go on and pay when it is won signed in", async () => {
    const user = await makeUser();
    await adopt(user, [misses[0], misses[1]]);

    const res = await guess(user, target.name);

    expect(res.body.play.won).toBe(true);
    expect(res.body.play.reward).toBe(halo.rewardFor(3, 1));
  });
});
