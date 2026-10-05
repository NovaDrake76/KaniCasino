process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
// the verified-only commission rule starts in the past here, so a wager made now falls under it
process.env.REFERRAL_VERIFIED_FROM = "2026-01-01T00:00:00Z";

// the google login path verifies a real token; stand in for google so a fake token
// resolves to whatever payload the test sets
let mockGooglePayload = null;
jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockImplementation(() => Promise.resolve({ getPayload: () => mockGooglePayload })),
  })),
}));

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix, betOnDays } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const Notification = require("../../models/Notification");
const IpSighting = require("../../models/IpSighting");
const { TX, awardXp, calculateXPForLevel, chargeUser } = require("../../utils/economy");
const { HOUSE, MINT } = require("../../utils/accounts");
const {
  REFERRER_SIGNUP_BONUS,
  REFEREE_SIGNUP_BONUS,
  MILESTONE_LEVEL,
  MILESTONE_DAYS,
  MILESTONE_BONUS,
  COMMISSION_SHARE,
  HOUSE_EDGE,
  LEGACY_COMMISSION_RATE,
  maybePayReferralMilestone,
  sweepReferrals,
} = require("../../utils/referrals");
const verification = require("../../utils/verification");
const ipSightings = require("../../utils/ipSightings");

// the level hooks fire and forget, so tests wait for the money to land
async function waitFor(check, ms = 2000) {
  const start = Date.now();
  for (;;) {
    if (await check()) return true;
    if (Date.now() - start > ms) return false;
    await new Promise((r) => setTimeout(r, 25));
  }
}

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

// a referee the rules count: verified by an emailed link
const makeVerified = (overrides = {}) => makeUser({ emailVerifiedAt: new Date(), ...overrides });

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

const wager = (userId, amount, createdAt, type = TX.CRASH_BET) => {
  const doc = { userId, type, direction: "debit", amount };
  if (createdAt) doc.createdAt = createdAt;
  return Transaction.create(doc);
};

// the accounts seen on one connection, which is what holds a referral for staff
const sameConnection = async (...users) => {
  const ipHash = ipSightings.hashIp(`10.0.${uniqueSuffix()}`);
  const at = new Date();
  for (const u of users) await IpSighting.create({ userId: u._id, ipHash, firstAt: at, lastAt: at });
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
  test("the referee gets 500 at once; the referrer's 1000 waits until the referee is verified", async () => {
    const referrer = await makeUser({ referralCode: "FRIEND", walletBalance: 0 });

    const res = await registerWith("friend"); // lowercase on purpose
    expect(res.status).toBe(200);

    const referee = await User.findOne({ referredBy: referrer._id });
    expect(referee).not.toBeNull();
    expect(referee.walletBalance).toBe(200 + REFEREE_SIGNUP_BONUS);
    expect(referee.referralBonusPending).toBe(true);
    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
    expect(await Notification.countDocuments({ receiverId: referrer._id, title: "Referral bonus" })).toBe(1);

    await User.updateOne({ _id: referee._id }, { $set: { emailVerifiedAt: new Date() } });
    await verification.onVerified(referee._id);
    // a second verification (a discord link on top) pays nothing more
    await verification.onVerified(referee._id);

    expect((await User.findById(referrer._id)).walletBalance).toBe(REFERRER_SIGNUP_BONUS);
    const rows = await Transaction.find({ type: TX.REFERRAL_BONUS }).lean();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.direction === "credit" && String(r.counterparty) === String(MINT))).toBe(true);
    const byRole = Object.fromEntries(rows.map((r) => [r.meta.role, r.amount]));
    expect(byRole).toEqual({ referee: REFEREE_SIGNUP_BONUS, referrer: REFERRER_SIGNUP_BONUS });

    expect(await Notification.countDocuments({ receiverId: referee._id, title: "Referral bonus" })).toBe(1);
    expect(await Notification.countDocuments({ receiverId: referrer._id, title: "Referral bonus" })).toBe(2);
  });

  test("a referee that never verifies earns its referrer nothing", async () => {
    const referrer = await makeUser({ referralCode: "NEVER", walletBalance: 0 });
    await registerWith("NEVER");
    const referee = await User.findOne({ referredBy: referrer._id });

    await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL);
    await Transaction.create({ userId: referee._id, type: TX.CRASH_BET, direction: "debit", amount: 5000 });
    const dash = await auth(request(app).get("/referrals/me"), referrer);

    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
    expect(dash.body.referrals[0].verified).toBe(false);
    expect(dash.body.referrals[0].commission).toBe(0);
    expect(dash.body.totals.earned).toBe(0);
  });

  test("an unverified referee's wagers from before the rule still earn commission", async () => {
    const me = await makeUser({ referralCode: "OLDTIMER" });
    const referee = await makeUser({ referredBy: me._id });
    await wager(referee._id, 3000, new Date("2025-12-31T12:00:00Z"));
    await wager(referee._id, 5000);

    const before = await auth(request(app).get("/referrals/me"), me);
    expect(before.body.referrals[0].verified).toBe(false);
    expect(before.body.referrals[0].commission).toBe(30);

    await User.updateOne({ _id: referee._id }, { $set: { emailVerifiedAt: new Date() } });
    const after = await auth(request(app).get("/referrals/me"), me);
    expect(after.body.referrals[0].commission).toBe(80);
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

describe("google sign-in with a referral code", () => {
  const googleLogin = (referralCode) =>
    request(app).post("/users/googlelogin").send({ token: "fake", referralCode });
  // the code rides through to the finishing step, which is what creates the account now
  const finish = (ticket, username, referralCode) =>
    request(app).post("/users/google/complete").send({ ticket, username, referralCode });

  test("a first google sign-in is a registration: both bonuses land", async () => {
    const referrer = await makeUser({ referralCode: "GFRIEND", walletBalance: 0 });
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: `g-${s}`, picture: "p.png", sub: `sub-${s}` };

    const started = await googleLogin("GFRIEND");
    expect(started.body.needsProfile).toBe(true);
    const res = await finish(started.body.ticket, `g-${s}`, "GFRIEND");
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    const referee = await User.findOne({ email: mockGooglePayload.email });
    expect(String(referee.referredBy)).toBe(String(referrer._id));
    expect(referee.walletBalance).toBe(200 + REFEREE_SIGNUP_BONUS);
    expect((await User.findById(referrer._id)).walletBalance).toBe(REFERRER_SIGNUP_BONUS);
  });

  test("nothing is paid until the account is actually finished", async () => {
    // the step can be abandoned, and a bonus for an account that was never created would
    // be money out of the house for nobody
    const referrer = await makeUser({ referralCode: "GFRIEND3", walletBalance: 0 });
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: `g-${s}`, picture: "p.png", sub: `sub-${s}` };

    await googleLogin("GFRIEND3");

    expect(await User.findOne({ email: mockGooglePayload.email })).toBeNull();
    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
    expect(await Transaction.countDocuments({ type: TX.REFERRAL_BONUS })).toBe(0);
  });

  test("an existing account logging in with a code gets and changes nothing", async () => {
    const referrer = await makeUser({ referralCode: "GFRIEND2", walletBalance: 0 });
    const existing = await makeUser({ walletBalance: 777 });
    mockGooglePayload = { email: existing.email, name: existing.username, picture: "p.png", sub: `sub-${uniqueSuffix()}` };

    const res = await googleLogin("GFRIEND2");
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    const after = await User.findById(existing._id);
    expect(after.referredBy).toBeUndefined();
    expect(after.walletBalance).toBe(777);
    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
    expect(await Transaction.countDocuments({ type: TX.REFERRAL_BONUS })).toBe(0);
  });
});

describe("the level milestone", () => {
  test("a referee reaching the level pays the referrer once, with notifications", async () => {
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeVerified({ referredBy: referrer._id, level: MILESTONE_LEVEL });
    await betOnDays(referee._id, MILESTONE_DAYS);

    await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL);

    expect((await User.findById(referrer._id)).walletBalance).toBe(MILESTONE_BONUS);
    expect((await User.findById(referee._id)).referralMilestonePaid).toBe(true);
    const row = await Transaction.findOne({ userId: referrer._id, type: TX.REFERRAL_MILESTONE });
    expect(row.amount).toBe(MILESTONE_BONUS);
    expect(String(row.counterparty)).toBe(String(MINT));
    expect(await Notification.countDocuments({ title: "Referral milestone" })).toBe(2);

    // reaching further levels never pays again
    await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL + 3);
    expect((await User.findById(referrer._id)).walletBalance).toBe(MILESTONE_BONUS);
    expect(await Transaction.countDocuments({ type: TX.REFERRAL_MILESTONE })).toBe(1);
  });

  test("the level alone pays nothing: the referee also has to have played on seven different days", async () => {
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeVerified({ referredBy: referrer._id, level: MILESTONE_LEVEL });
    await betOnDays(referee._id, MILESTONE_DAYS - 1);
    // many bets on one day are still one day
    await wager(referee._id, 500);
    await wager(referee._id, 500);

    await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL);
    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
    expect(await sweepReferrals()).toBe(0);

    // the seventh day comes and the sweep pays it, once
    await wager(referee._id, 10, new Date(Date.now() - MILESTONE_DAYS * 864e5));
    expect(await sweepReferrals()).toBe(1);
    expect(await sweepReferrals()).toBe(0);
    expect((await User.findById(referrer._id)).walletBalance).toBe(MILESTONE_BONUS);
    const note = await Notification.findOne({ receiverId: referrer._id, title: "Referral milestone" });
    expect(note.content).toMatch(/7 different days/);
  });

  test("a referee past the level is paid for the moment they verify, once", async () => {
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeUser({ referredBy: referrer._id, level: MILESTONE_LEVEL + 2 });
    await betOnDays(referee._id, MILESTONE_DAYS);

    await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL + 2);
    expect((await User.findById(referrer._id)).walletBalance).toBe(0);

    await User.updateOne({ _id: referee._id }, { $set: { discordId: `d-${uniqueSuffix()}` } });
    await verification.onVerified(referee._id);
    await verification.onVerified(referee._id);

    expect((await User.findById(referrer._id)).walletBalance).toBe(MILESTONE_BONUS);
    expect(await Transaction.countDocuments({ type: TX.REFERRAL_MILESTONE })).toBe(1);
  });

  test("below the level, or with no referrer, nothing happens", async () => {
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeUser({ referredBy: referrer._id });
    const loner = await makeUser();

    await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL - 1);
    await maybePayReferralMilestone(loner._id, MILESTONE_LEVEL);

    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
    expect(await Transaction.countDocuments({ type: TX.REFERRAL_MILESTONE })).toBe(0);
  });

  test("levelling up through play triggers the payout by itself", async () => {
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeVerified({ referredBy: referrer._id });
    await betOnDays(referee._id, MILESTONE_DAYS);

    await awardXp(referee._id, calculateXPForLevel(MILESTONE_LEVEL));

    const paid = await waitFor(async () =>
      (await User.findById(referrer._id)).walletBalance === MILESTONE_BONUS
    );
    expect(paid).toBe(true);
    expect((await User.findById(referee._id)).level).toBeGreaterThanOrEqual(MILESTONE_LEVEL);
  });

  test("a bet that crosses the level pays it, from the account the bet already holds", async () => {
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeVerified({ referredBy: referrer._id, xp: calculateXPForLevel(MILESTONE_LEVEL) - 1, level: MILESTONE_LEVEL - 1 });
    // six earlier days, and the bet itself is the seventh
    for (let i = 1; i < MILESTONE_DAYS; i++) await wager(referee._id, 10, new Date(Date.now() - i * 864e5));

    await chargeUser(referee._id, 100, { type: TX.DICE_BET });

    const paid = await waitFor(async () =>
      (await User.findById(referrer._id)).walletBalance === MILESTONE_BONUS
    );
    expect(paid).toBe(true);
  });

  test("a bet by a player nobody referred, one already paid for, or one the rules do not count yet reads nothing more", async () => {
    const loner = await makeUser({ level: MILESTONE_LEVEL + 5 });
    const read = jest.spyOn(User, "findOne");
    try {
      await maybePayReferralMilestone(loner._id, MILESTONE_LEVEL + 5, { referredBy: null });
      await maybePayReferralMilestone(loner._id, MILESTONE_LEVEL + 5, { referredBy: loner._id, referralMilestonePaid: true });
      await maybePayReferralMilestone(loner._id, MILESTONE_LEVEL + 5, { referredBy: loner._id });
      await maybePayReferralMilestone(loner._id, MILESTONE_LEVEL + 5, { referredBy: loner._id, emailVerifiedAt: new Date(), referralReview: "rejected" });
      expect(read).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
    }
  });

  test("a waiting referee's bets look at their days once a day, not on every bet", async () => {
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeVerified({ referredBy: referrer._id, level: MILESTONE_LEVEL, walletBalance: 5000 });
    await betOnDays(referee._id, 2);
    const read = jest.spyOn(User, "findOne");
    try {
      for (let i = 0; i < 4; i++) await chargeUser(referee._id, 10, { type: TX.DICE_BET });
      await waitFor(async () => read.mock.calls.length > 0);
      await new Promise((r) => setTimeout(r, 100));
      expect(read).toHaveBeenCalledTimes(1);
    } finally {
      read.mockRestore();
    }
    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
  });
});

describe("real-money mode turns referrals off", () => {
  beforeEach(() => {
    process.env.REAL_MONEY_MODE = "true";
  });
  afterEach(() => {
    delete process.env.REAL_MONEY_MODE;
  });

  test("registration ignores codes entirely", async () => {
    const referrer = await makeUser({ referralCode: "OFFMODE", walletBalance: 0 });
    const res = await registerWith("OFFMODE");
    expect(res.status).toBe(200);
    expect(await User.findOne({ referredBy: referrer._id })).toBeNull();
    expect(await Transaction.countDocuments({ type: TX.REFERRAL_BONUS })).toBe(0);
  });

  test("the dashboard reports disabled and the write endpoints refuse", async () => {
    const u = await makeUser();
    const me = await auth(request(app).get("/referrals/me"), u);
    expect(me.body).toEqual({ enabled: false });
    expect((await auth(request(app).post("/referrals/code"), u).send({ code: "ABC" })).status).toBe(403);
    expect((await auth(request(app).post("/referrals/claim"), u)).status).toBe(403);
  });

  test("the milestone does not pay", async () => {
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeUser({ referredBy: referrer._id });
    await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL);
    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
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

  test("before the edge rule, commission is one percent of referred wagers only, floored per referee", async () => {
    const me = await makeUser({ referralCode: "MYCODE" });
    const whale = await makeVerified({ referredBy: me._id });
    const minnow = await makeVerified({ referredBy: me._id });
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
    expect(top.commission).toBe(Math.floor(2550 * LEGACY_COMMISSION_RATE));
    expect(bottom.wagered).toBe(149);
    expect(bottom.commission).toBe(1);
    expect(res.body.totals.totalWagered).toBe(2699);
    expect(res.body.totals.earned).toBe(26);
    expect(res.body.totals.available).toBe(26);
    expect(res.body.totals.referralCount).toBe(2);
  });

  test("from the edge rule on, commission is a quarter of the house's edge on each bet, and predictions earn none", async () => {
    process.env.REFERRAL_EDGE_FROM = "2026-01-01T00:00:00Z";
    try {
      const me = await makeUser({ referralCode: "EDGY" });
      const referee = await makeVerified({ referredBy: me._id });
      // a stake from before the rule keeps the one percent it was made under
      await wager(referee._id, 1000, new Date("2025-12-31T12:00:00Z"));
      await wager(referee._id, 10000);
      await wager(referee._id, 10000, null, TX.BLACKJACK_BET);
      await wager(referee._id, 10000, null, TX.CASE_OPEN);
      await wager(referee._id, 10000, null, TX.PREDICTION_BUY);

      const res = await auth(request(app).get("/referrals/me"), me);
      const edge = 10000 * (HOUSE_EDGE[TX.CRASH_BET] + HOUSE_EDGE[TX.BLACKJACK_BET] + HOUSE_EDGE[TX.CASE_OPEN]);
      expect(res.body.referrals[0].commission).toBe(Math.floor(1000 * LEGACY_COMMISSION_RATE + edge * COMMISSION_SHARE));
      // 10 from the old stake, then 99.25 on crash, 12.5 on blackjack and 250 on cases
      expect(res.body.referrals[0].commission).toBe(371);
      expect(res.body.commissionShare).toBe(COMMISSION_SHARE);
      expect(res.body.milestoneDays).toBe(MILESTONE_DAYS);
    } finally {
      process.env.REFERRAL_EDGE_FROM = "2100-01-01T00:00:00Z";
    }
  });

  test("shows each referee's days played", async () => {
    const me = await makeUser();
    const referee = await makeVerified({ referredBy: me._id });
    await betOnDays(referee._id, 3);
    await wager(referee._id, 100);

    const res = await auth(request(app).get("/referrals/me"), me);
    expect(res.body.referrals[0]).toMatchObject({ daysPlayed: 3, review: null });
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
    const referee = await makeVerified({ referredBy: me._id });
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
    const referee = await makeVerified({ referredBy: me._id });
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

describe("a referee on their referrer's connection", () => {
  // the hold stops the edge share, so these wagers fall under it
  beforeEach(() => {
    process.env.REFERRAL_EDGE_FROM = "2026-01-01T00:00:00Z";
  });
  afterEach(() => {
    process.env.REFERRAL_EDGE_FROM = "2100-01-01T00:00:00Z";
  });

  test("is held: no bonus, no milestone and no commission until staff look at it", async () => {
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeUser({ referredBy: referrer._id, referralBonusPending: true, level: MILESTONE_LEVEL });
    await sameConnection(referrer, referee);
    await betOnDays(referee._id, MILESTONE_DAYS);
    await wager(referee._id, 100000);

    await User.updateOne({ _id: referee._id }, { $set: { emailVerifiedAt: new Date() } });
    await verification.onVerified(referee._id);
    expect(await sweepReferrals()).toBe(0);

    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
    const dash = await auth(request(app).get("/referrals/me"), referrer);
    expect(dash.body.referrals[0].review).toBe("held");
    expect(dash.body.totals.earned).toBe(0);
    expect((await auth(request(app).post("/referrals/claim"), referrer)).status).toBe(400);
  });

  test("shows up in the staff queue, and an approval pays everything that waited, once", async () => {
    const staff = await makeUser({ isAdmin: true });
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeVerified({ referredBy: referrer._id, referralBonusPending: true, level: MILESTONE_LEVEL });
    await sameConnection(referrer, referee);
    await betOnDays(referee._id, MILESTONE_DAYS);

    const queue = await auth(request(app).get("/admin/referrals/held"), staff);
    expect(queue.status).toBe(200);
    expect(queue.body).toHaveLength(1);
    expect(queue.body[0]).toMatchObject({ id: String(referee._id), daysPlayed: MILESTONE_DAYS, bonusPending: true, verified: true });
    expect(queue.body[0].referrer.username).toBe(referrer.username);

    const res = await auth(request(app).post(`/admin/referrals/${referee._id}/review`), staff).send({ decision: "approved" });
    expect(res.status).toBe(200);
    expect(res.body.paid).toEqual({ bonus: true, milestone: true });
    expect((await User.findById(referrer._id)).walletBalance).toBe(REFERRER_SIGNUP_BONUS + MILESTONE_BONUS);

    // cleared for good: the shared connection no longer holds anything, and nothing pays twice
    expect((await auth(request(app).get("/admin/referrals/held"), staff)).body).toHaveLength(0);
    expect(await sweepReferrals()).toBe(0);
    expect((await User.findById(referrer._id)).walletBalance).toBe(REFERRER_SIGNUP_BONUS + MILESTONE_BONUS);
  });

  test("a rejection means the referee never earns their referrer anything", async () => {
    const staff = await makeUser({ isAdmin: true });
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeVerified({ referredBy: referrer._id, referralBonusPending: true, level: MILESTONE_LEVEL });
    await sameConnection(referrer, referee);
    await betOnDays(referee._id, MILESTONE_DAYS);
    await wager(referee._id, 100000);

    const res = await auth(request(app).post(`/admin/referrals/${referee._id}/review`), staff).send({ decision: "rejected" });
    expect(res.status).toBe(200);
    expect(await sweepReferrals()).toBe(0);
    await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL);

    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
    const dash = await auth(request(app).get("/referrals/me"), referrer);
    expect(dash.body.referrals[0]).toMatchObject({ review: "rejected", commission: 0 });
    expect(dash.body.totals.earned).toBe(0);
  });

  test("what the old rules paid stays earned, held or rejected: nothing is clawed back", async () => {
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeVerified({ referredBy: referrer._id });
    await sameConnection(referrer, referee);
    await wager(referee._id, 5000, new Date("2025-12-31T12:00:00Z"));
    await wager(referee._id, 100000);

    const held = await auth(request(app).get("/referrals/me"), referrer);
    expect(held.body.referrals[0]).toMatchObject({ review: "held", commission: 50 });
    expect(held.body.totals.earned).toBe(50);

    await User.updateOne({ _id: referee._id }, { $set: { referralReview: "rejected" } });
    const rejected = await auth(request(app).get("/referrals/me"), referrer);
    expect(rejected.body.totals.earned).toBe(50);
  });

  test("staff decisions are staff only, and only approve or reject", async () => {
    const staff = await makeUser({ isAdmin: true });
    const player = await makeUser();
    const referee = await makeUser({ referredBy: player._id });

    expect((await auth(request(app).get("/admin/referrals/held"), player)).status).toBe(403);
    expect((await auth(request(app).post(`/admin/referrals/${referee._id}/review`), player).send({ decision: "approved" })).status).toBe(403);
    expect((await auth(request(app).post(`/admin/referrals/${referee._id}/review`), staff).send({ decision: "maybe" })).status).toBe(400);
    expect((await auth(request(app).post(`/admin/referrals/${player._id}/review`), staff).send({ decision: "approved" })).status).toBe(404);
  });

  test("a signup from the referrer's own connection is held from the start, and the referrer is told why", async () => {
    const referrer = await makeUser({ referralCode: "SAMEROOF", walletBalance: 0 });
    const ip = "203.0.113.7";
    await IpSighting.create({ userId: referrer._id, ipHash: ipSightings.hashIp(ip), firstAt: new Date(), lastAt: new Date() });

    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: `g-${s}`, picture: "p.png", sub: `sub-${s}` };
    const started = await request(app).post("/users/googlelogin").set("cf-connecting-ip", ip).send({ token: "fake", referralCode: "SAMEROOF" });
    const res = await request(app)
      .post("/users/google/complete")
      .set("cf-connecting-ip", ip)
      .send({ ticket: started.body.ticket, username: `g-${s}`, referralCode: "SAMEROOF" });
    expect(res.status).toBe(200);

    // a google account is verified at once, and still nothing is paid
    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
    const note = await Notification.findOne({ receiverId: referrer._id, title: "Referral bonus" });
    expect(note.content).toMatch(/review/);
  });
});
