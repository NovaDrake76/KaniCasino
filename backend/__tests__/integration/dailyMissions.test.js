process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const MissionState = require("../../models/MissionState");
const { TX } = require("../../utils/economy");
const { DAY_MS, SLOTS, dayOf, missionsOn, scaled } = require("../../utils/dailyCatalog");
const { MINT } = require("../../utils/accounts");

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
    username: `Mio ${s}`,
    slug: `mio-${s}`,
    email: `m${s}@k.co`,
    walletBalance: 1000,
    betaFlags: ["daisu"],
    emailVerifiedAt: new Date(),
    ...fields,
  });
};

const BET_OF = {
  dice: TX.DICE_BET,
  plinko: TX.PLINKO_BET,
  slots: TX.SLOT_BET,
  mines: TX.MINES_BET,
  hilo: TX.HILO_BET,
  blackjack: TX.BLACKJACK_BET,
  crash: TX.CRASH_BET,
  coinflip: TX.COINFLIP_BET,
};

const as = (user, req) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const dailyOf = async (user) => (await as(user, request(app).get("/daisu/missions"))).body.daily;
const claim = (user, key) => as(user, request(app).post(`/daisu/missions/daily/${key}/claim`));
const today = dayOf(Date.now());
const midnight = today * DAY_MS;
const rounds = missionsOn(today).find((m) => m.goal === "rounds");
const bets = (userId, n, createdAt) =>
  Transaction.insertMany(Array.from({ length: n }, () => ({ userId, type: BET_OF[rounds.game], amount: 1, direction: "debit", ...(createdAt ? { createdAt } : {}) })));

describe("daisu's daily requests", () => {
  it("turns every slot by the day, so no request comes back the next day", () => {
    for (let day = today; day < today + 30; day++) {
      const [a, b] = [missionsOn(day), missionsOn(day + 1)];
      expect(a).toHaveLength(SLOTS.length);
      a.forEach((m, i) => expect(m.key).not.toBe(b[i].key));
    }
  });

  it("lists today's three beside her chapter, with when they turn over", async () => {
    const user = await makeUser();

    const res = await as(user, request(app).get("/daisu/missions"));

    expect(res.body.chapter).toBe(1);
    expect(res.body.daily.missions.map((m) => m.key)).toEqual(missionsOn(today).map((m) => m.key));
    expect(res.body.daily.resetsAt).toBe(new Date(midnight + DAY_MS).toISOString());
    expect(res.body.daily.missions.every((m) => !m.complete && m.current === 0)).toBe(true);
  });

  it("counts only rounds played since midnight utc", async () => {
    const user = await makeUser();
    await bets(user._id, rounds.target, new Date(midnight - 1000));
    await bets(user._id, rounds.target - 1);
    expect((await dailyOf(user)).missions.find((m) => m.key === rounds.key)).toMatchObject({ current: rounds.target - 1, complete: false });

    await bets(user._id, 1);

    expect((await dailyOf(user)).missions.find((m) => m.key === rounds.key)).toMatchObject({ complete: true, claimable: true });
  });

  it("pays a finished request once, from the mint, and marks it claimed", async () => {
    const user = await makeUser();
    await bets(user._id, rounds.target);

    const first = await claim(user, rounds.key);
    const again = await claim(user, rounds.key);

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ claimed: true, reward: rounds.reward, walletBalance: 1000 + rounds.reward });
    expect(first.body.daily.missions.find((m) => m.key === rounds.key)).toMatchObject({ claimed: true, claimable: false });
    expect(again.body).toMatchObject({ claimed: false, alreadyClaimed: true });
    const paid = await Transaction.find({ userId: user._id, type: TX.MISSION_REWARD }).lean();
    expect(paid).toHaveLength(1);
    expect(paid[0].meta).toMatchObject({ missionKey: rounds.key, daily: new Date(midnight).toISOString().slice(0, 10) });
    expect(String(paid[0].counterparty)).toBe(String(MINT));
  });

  it("pays once when two claims land together", async () => {
    const user = await makeUser();
    await bets(user._id, rounds.target);

    await Promise.all([claim(user, rounds.key), claim(user, rounds.key), claim(user, rounds.key)]);

    expect(await Transaction.countDocuments({ userId: user._id, type: TX.MISSION_REWARD })).toBe(1);
    expect((await User.findById(user._id).lean()).walletBalance).toBe(1000 + rounds.reward);
  });

  it("starts the claims over on a new day", async () => {
    const user = await makeUser();
    await MissionState.create({ userId: user._id, daily: { day: new Date(midnight - DAY_MS).toISOString().slice(0, 10), claimed: [rounds.key] } });
    await bets(user._id, rounds.target);

    expect((await dailyOf(user)).missions.find((m) => m.key === rounds.key)).toMatchObject({ claimed: false, claimable: true });
    expect((await claim(user, rounds.key)).body.claimed).toBe(true);
  });

  it("sizes rewards by the pot's multiplier, and only a K₽ goal's target with them", async () => {
    expect([scaled(300, 0), scaled(750, 3), scaled(300, 55), scaled(10000, 50), scaled(500, 2.7)]).toEqual([300, 975, 1950, 60000, 600]);
    const user = await makeUser({ level: 20 });

    const shown = (await dailyOf(user)).missions;

    missionsOn(today).forEach((m, i) => {
      expect(shown[i].reward).toBe(m.reward * 3);
      expect(shown[i].target).toBe(m.scaleTarget ? m.target * 3 : m.target);
    });
    expect(SLOTS.flat().filter((m) => m.scaleTarget).map((m) => m.goal)).toEqual(["staked"]);
  });

  it("keeps the day's sizes when the player levels up, and pays what was shown", async () => {
    const user = await makeUser({ level: 10 });
    await bets(user._id, rounds.target);
    expect((await dailyOf(user)).missions.find((m) => m.key === rounds.key).reward).toBe(rounds.reward * 2);

    await User.updateOne({ _id: user._id }, { $set: { level: 40 } });
    expect((await dailyOf(user)).missions.find((m) => m.key === rounds.key).reward).toBe(rounds.reward * 2);
    const paid = await claim(user, rounds.key);

    expect(paid.body).toMatchObject({ claimed: true, reward: rounds.reward * 2, walletBalance: 1000 + rounds.reward * 2 });
    expect((await Transaction.findOne({ userId: user._id, type: TX.MISSION_REWARD }).lean()).meta.level).toBe(10);
  });

  it("sizes a new day at the level the player has reached", async () => {
    const user = await makeUser({ level: 30 });
    await MissionState.create({ userId: user._id, daily: { day: new Date(midnight - DAY_MS).toISOString().slice(0, 10), claimed: [], level: 5 } });

    expect((await dailyOf(user)).missions.find((m) => m.key === rounds.key).reward).toBe(rounds.reward * 4);
    expect((await MissionState.findOne({ userId: user._id }).lean()).daily).toMatchObject({ claimed: [], level: 30 });
  });

  it("refuses a request that is not today's, one not finished, and an unverified account", async () => {
    const user = await makeUser();
    const other = SLOTS.flat().find((m) => !missionsOn(today).some((t) => t.key === m.key));
    expect((await claim(user, other.key)).status).toBe(404);
    expect((await claim(user, rounds.key)).status).toBe(400);

    const lockFrom = process.env.VERIFY_REQUIRED_FROM;
    process.env.VERIFY_REQUIRED_FROM = new Date(Date.now() - DAY_MS).toISOString();
    try {
      const unverified = await makeUser({ emailVerifiedAt: null });
      await bets(unverified._id, rounds.target);
      const res = await claim(unverified, rounds.key);
      expect(res.status).toBe(403);
      expect(res.body.reason).toBe("verify");
      expect(await Transaction.countDocuments({ userId: unverified._id, type: TX.MISSION_REWARD })).toBe(0);
    } finally {
      process.env.VERIFY_REQUIRED_FROM = lockFrom;
    }
  });
});
