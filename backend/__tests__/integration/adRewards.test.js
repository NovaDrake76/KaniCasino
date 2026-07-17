process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
// tests should not sit through a real watch window
process.env.AD_REWARD_MIN_WATCH_MS = "50";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const AdWatch = require("../../models/AdWatch");
const { TX } = require("../../utils/economy");
const { MINT } = require("../../utils/accounts");
const { AD_REWARD_AMOUNT, AD_REWARD_DAILY_CAP } = require("../../utils/adRewards");

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
    walletBalance: 0,
    ...overrides,
  });
}

const auth = (req, user) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const start = (user) => auth(request(app).post("/rewards/ads/start"), user);
const claim = (user, token) => auth(request(app).post("/rewards/ads/claim"), user).send({ token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// a full legitimate view: start, wait out the minimum, claim
async function watchOne(user) {
  const s = await start(user);
  expect(s.status).toBe(200);
  await sleep(80);
  return claim(user, s.body.token);
}

describe("rewarded ads", () => {
  test("requires auth", async () => {
    expect((await request(app).get("/rewards/ads")).status).toBe(401);
    expect((await request(app).post("/rewards/ads/start")).status).toBe(401);
  });

  test("status reports the offer and what is left today", async () => {
    const u = await makeUser();
    const res = await auth(request(app).get("/rewards/ads"), u);
    expect(res.body).toMatchObject({
      enabled: true,
      provider: "mock",
      amount: AD_REWARD_AMOUNT,
      dailyCap: AD_REWARD_DAILY_CAP,
      remainingToday: AD_REWARD_DAILY_CAP,
    });
  });

  test("a completed view pays once, minted, and counts down the day", async () => {
    const u = await makeUser();
    const res = await watchOne(u);

    expect(res.status).toBe(200);
    expect(res.body.claimed).toBe(AD_REWARD_AMOUNT);
    expect(res.body.walletBalance).toBe(AD_REWARD_AMOUNT);
    expect(res.body.remainingToday).toBe(AD_REWARD_DAILY_CAP - 1);
    expect(res.body.user).toBeUndefined(); // the raw doc stays server-side

    const row = await Transaction.findOne({ userId: u._id, type: TX.AD_REWARD });
    expect(row.amount).toBe(AD_REWARD_AMOUNT);
    expect(String(row.counterparty)).toBe(String(MINT));
  });

  test("claiming faster than a video could play is refused", async () => {
    const u = await makeUser();
    const s = await start(u);
    const res = await claim(u, s.body.token); // immediate
    expect(res.status).toBe(400);
    expect((await User.findById(u._id)).walletBalance).toBe(0);
  });

  test("a token pays exactly once and only for its owner", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const s = await start(u);
    await sleep(80);

    expect((await claim(other, s.body.token)).status).toBe(400); // not theirs
    expect((await claim(u, s.body.token)).status).toBe(200);
    expect((await claim(u, s.body.token)).status).toBe(400); // spent
    expect((await claim(u, "no-such-token")).status).toBe(400);
    expect((await User.findById(u._id)).walletBalance).toBe(AD_REWARD_AMOUNT);
  });

  test("the daily cap stops both new tokens and further claims", async () => {
    const u = await makeUser();
    // the ledger already shows a full day of rewards
    for (let i = 0; i < AD_REWARD_DAILY_CAP; i++) {
      await Transaction.create({ userId: u._id, type: TX.AD_REWARD, direction: "credit", amount: AD_REWARD_AMOUNT });
    }

    expect((await start(u)).status).not.toBe(200); // no fresh token either way
    const status = await auth(request(app).get("/rewards/ads"), u);
    expect(status.body.remainingToday).toBe(0);

    // a token hoarded from earlier cannot beat the cap at claim time
    const hoarded = await AdWatch.create({ userId: u._id, token: `t-${uniqueSuffix()}` });
    await sleep(80);
    expect((await claim(u, hoarded.token)).status).toBe(429);
    expect((await User.findById(u._id)).walletBalance).toBe(0);
  });

  test("sequential starts stop issuing at the cap", async () => {
    const u = await makeUser();
    let ok = 0;
    for (let i = 0; i < AD_REWARD_DAILY_CAP + 3; i++) {
      if ((await start(u)).status === 200) ok += 1;
    }
    expect(ok).toBe(AD_REWARD_DAILY_CAP);
    expect(await AdWatch.countDocuments({ userId: u._id })).toBe(AD_REWARD_DAILY_CAP);
  });
});

describe("real-money mode turns ad rewards off", () => {
  beforeEach(() => {
    process.env.REAL_MONEY_MODE = "true";
  });
  afterEach(() => {
    delete process.env.REAL_MONEY_MODE;
  });

  test("status reports disabled and both endpoints refuse", async () => {
    const u = await makeUser();
    expect((await auth(request(app).get("/rewards/ads"), u)).body).toEqual({ enabled: false });
    expect((await start(u)).status).toBe(403);
    expect((await claim(u, "any")).status).toBe(403);
  });
});
