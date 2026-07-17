process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");
const { HOUSE, MINT } = require("../../utils/accounts");
const { REFERRAL_SIGNUP_BONUS, COMMISSION_RATE } = require("../../utils/referrals");

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

const auth = (req, user) => req.set("Authorization", `Bearer ${tokenFor(user)}`);

const registerWith = (referralCode) => {
  const s = uniqueSuffix();
  return request(app).post("/users/register").send({
    email: `new-${s}@x.com`,
    username: `new-${s}`,
    password: "secret1",
    profilePicture: "",
    referralCode,
  });
};

const wager = (userId, amount, createdAt) => {
  const doc = { userId, type: TX.CRASH_BET, direction: "debit", amount };
  if (createdAt) doc.createdAt = createdAt;
  return Transaction.create(doc);
};

describe("POST /referrals/code", () => {
  test("requires auth", async () => {
    expect((await request(app).post("/referrals/code").send({ code: "ABC" })).status).toBe(401);
  });

  test("creates the code uppercased and persists it", async () => {
    const u = await makeUser();
    const res = await auth(request(app).post("/referrals/code"), u).send({ code: "kani123" });
    expect(res.status).toBe(200);
    expect(res.body.referralCode).toBe("KANI123");
    expect((await User.findById(u._id)).referralCode).toBe("KANI123");
  });

  test("rejects codes outside 3-16 alphanumerics", async () => {
    const u = await makeUser();
    for (const bad of ["ab", "a".repeat(17), "has space", "sneaky-!", ""]) {
      const res = await auth(request(app).post("/referrals/code"), u).send({ code: bad });
      expect(res.status).toBe(400);
    }
    expect((await User.findById(u._id)).referralCode).toBeUndefined();
  });

  test("the code is set once and never changes", async () => {
    const u = await makeUser();
    await auth(request(app).post("/referrals/code"), u).send({ code: "FIRST" });
    const res = await auth(request(app).post("/referrals/code"), u).send({ code: "SECOND" });
    expect(res.status).toBe(400);
    expect((await User.findById(u._id)).referralCode).toBe("FIRST");
  });

  test("a taken code is refused", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await auth(request(app).post("/referrals/code"), a).send({ code: "SAME" });
    const res = await auth(request(app).post("/referrals/code"), b).send({ code: "same" });
    expect(res.status).toBe(409);
    expect((await User.findById(b._id)).referralCode).toBeUndefined();
  });
});

describe("registering through a referral link", () => {
  test("both sides get the signup bonus and a minted ledger row", async () => {
    const referrer = await makeUser({ referralCode: "FRIEND", walletBalance: 0 });

    const res = await registerWith("friend"); // lowercase on purpose
    expect(res.status).toBe(200);

    const referee = await User.findOne({ referredBy: referrer._id });
    expect(referee).not.toBeNull();
    expect(referee.walletBalance).toBe(200 + REFERRAL_SIGNUP_BONUS);
    expect((await User.findById(referrer._id)).walletBalance).toBe(REFERRAL_SIGNUP_BONUS);

    const rows = await Transaction.find({ type: TX.REFERRAL_BONUS }).lean();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.direction === "credit" && r.amount === REFERRAL_SIGNUP_BONUS)).toBe(true);
    expect(rows.every((r) => String(r.counterparty) === String(MINT))).toBe(true);
    const roles = rows.map((r) => r.meta.role).sort();
    expect(roles).toEqual(["referee", "referrer"]);
  });

  test("an unknown code is ignored and the signup still succeeds", async () => {
    const res = await registerWith("NOBODY");
    expect(res.status).toBe(200);
    expect(await Transaction.countDocuments({ type: TX.REFERRAL_BONUS })).toBe(0);
    const created = await User.findOne({ email: /new-/ });
    expect(created.referredBy).toBeUndefined();
    expect(created.walletBalance).toBe(200);
  });
});

describe("GET /referrals/me", () => {
  test("a fresh user has no code and zero totals", async () => {
    const u = await makeUser();
    const res = await auth(request(app).get("/referrals/me"), u);
    expect(res.status).toBe(200);
    expect(res.body.referralCode).toBeNull();
    expect(res.body.totals).toEqual({
      earned: 0, claimed: 0, available: 0, totalWagered: 0, referralCount: 0, activeCount: 0,
    });
    expect(res.body.referrals).toEqual([]);
  });

  test("commission derives from referred wagers only, floored per referee", async () => {
    const me = await makeUser({ referralCode: "MYCODE" });
    const whale = await makeUser({ referredBy: me._id });
    const minnow = await makeUser({ referredBy: me._id });
    const stranger = await makeUser();

    await wager(whale._id, 2000);
    await wager(whale._id, 550);
    await wager(minnow._id, 149);
    await wager(stranger._id, 100000); // not mine, must not count
    // a win is not a wager, so it earns nothing
    await Transaction.create({ userId: whale._id, type: TX.CRASH_CASHOUT, direction: "credit", amount: 5000 });

    const res = await auth(request(app).get("/referrals/me"), me);
    expect(res.status).toBe(200);
    const [top, bottom] = res.body.referrals;
    expect(top.username).toBe(whale.username);
    expect(top.wagered).toBe(2550);
    expect(top.commission).toBe(Math.floor(2550 * COMMISSION_RATE));
    expect(bottom.wagered).toBe(149);
    expect(bottom.commission).toBe(1);
    expect(res.body.totals.totalWagered).toBe(2699);
    expect(res.body.totals.earned).toBe(26);
    expect(res.body.totals.available).toBe(26);
    expect(res.body.totals.referralCount).toBe(2);
  });

  test("a referee is active only if they wagered this week", async () => {
    const me = await makeUser();
    const fresh = await makeUser({ referredBy: me._id });
    const dormant = await makeUser({ referredBy: me._id });
    await wager(fresh._id, 100);
    await wager(dormant._id, 100, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const res = await auth(request(app).get("/referrals/me"), me);
    const byName = Object.fromEntries(res.body.referrals.map((r) => [r.username, r.active]));
    expect(byName[fresh.username]).toBe(true);
    expect(byName[dormant.username]).toBe(false);
    expect(res.body.totals.activeCount).toBe(1);
  });
});

describe("POST /referrals/claim", () => {
  test("with nothing earned there is nothing to claim", async () => {
    const u = await makeUser();
    const res = await auth(request(app).post("/referrals/claim"), u);
    expect(res.status).toBe(400);
  });

  test("pays out the available commission from the house, exactly once", async () => {
    const me = await makeUser({ walletBalance: 0 });
    const referee = await makeUser({ referredBy: me._id });
    await wager(referee._id, 1000); // 10 earned

    const res = await auth(request(app).post("/referrals/claim"), me);
    expect(res.status).toBe(200);
    expect(res.body.claimed).toBe(10);
    expect(res.body.walletBalance).toBe(10);

    const after = await User.findById(me._id);
    expect(after.walletBalance).toBe(10);
    expect(after.referralClaimed).toBe(10);
    const row = await Transaction.findOne({ userId: me._id, type: TX.REFERRAL_COMMISSION });
    expect(row.amount).toBe(10);
    expect(String(row.counterparty)).toBe(String(HOUSE));

    // the well is dry until they wager more
    expect((await auth(request(app).post("/referrals/claim"), me)).status).toBe(400);
  });

  test("a later claim pays only what was earned since", async () => {
    const me = await makeUser({ walletBalance: 0 });
    const referee = await makeUser({ referredBy: me._id });
    await wager(referee._id, 1000);
    await auth(request(app).post("/referrals/claim"), me);

    await wager(referee._id, 500); // 5 more
    const res = await auth(request(app).post("/referrals/claim"), me);
    expect(res.status).toBe(200);
    expect(res.body.claimed).toBe(5);
    expect((await User.findById(me._id)).walletBalance).toBe(15);
    expect((await User.findById(me._id)).referralClaimed).toBe(15);
  });
});
