process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const mongoose = require("mongoose");
const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const BuyOrder = require("../../models/BuyOrder");
const IpSighting = require("../../models/IpSighting");
const Transaction = require("../../models/Transaction");
const leaderboard = require("../../utils/leaderboard");
const chat = require("../../utils/chat");
const rain = require("../../utils/rain");
const memo = require("../../utils/memo");
const { TX } = require("../../utils/economy");
const {
  REFERRER_SIGNUP_BONUS,
  COMMISSION_RATE,
  MILESTONE_LEVEL,
  MILESTONE_BONUS,
  settleOnVerified,
  maybePayReferralMilestone,
} = require("../../utils/referrals");

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(async () => {
  chat.reset();
  memo.clear();
  await clearDb();
});
afterAll(teardownDb);

const makeUser = (fields = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `l-${s}`, email: `l-${s}@mail.com`, password: "x", level: 30, walletBalance: 1000, ...fields });
};
const auth = (req, user) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const limit = (admin, user, reason) => auth(request(app).put(`/admin/users/${user._id}/limit`), admin).send({ reason });
const lift = (admin, user) => auth(request(app).delete(`/admin/users/${user._id}/limit`), admin);
const DAY = 24 * 60 * 60 * 1000;

describe("limiting an account", () => {
  test("staff limit with a reason, the player is told it, and lifting clears it", async () => {
    const admin = await makeUser({ isAdmin: true });
    const player = await makeUser();

    const res = await limit(admin, player, "Alt accounts feeding the market");
    expect(res.status).toBe(200);
    expect(res.body.limited).toMatchObject({ reason: "Alt accounts feeding the market", by: { username: admin.username } });

    const me = await auth(request(app).get("/users/me"), player);
    expect(me.body.limited).toMatchObject({ reason: "Alt accounts feeding the market" });

    const listed = await auth(request(app).get("/admin/limits"), admin);
    expect(listed.body.accounts.map((a) => a.username)).toEqual([player.username]);

    expect((await lift(admin, player)).body.limited).toBeNull();
    expect((await auth(request(app).get("/users/me"), player)).body.limited).toBeNull();
    expect((await User.findById(player._id).lean()).limited).toBeUndefined();
  });

  test("only staff can limit, and never without a reason", async () => {
    const admin = await makeUser({ isAdmin: true });
    const player = await makeUser();
    const other = await makeUser();

    expect((await limit(other, player, "because")).status).toBe(403);
    expect((await limit(admin, player, "   ")).status).toBe(400);
    expect((await limit(admin, admin, "self")).status).toBe(400);
    expect((await User.findById(player._id).lean()).limited).toBeUndefined();
  });
});

describe("what a limited account cannot do", () => {
  test("the market refuses its listings, buys and bids, but it can still cancel", async () => {
    const admin = await makeUser({ isAdmin: true });
    const player = await makeUser({ discordId: `d-${uniqueSuffix()}` });
    const open = await BuyOrder.create({ userId: player._id, item: new mongoose.Types.ObjectId(), itemName: "x", price: 10, quantity: 1, escrow: 10 });
    await limit(admin, player, "review");

    const bid = await auth(request(app).post("/marketplace/orders"), player).send({ itemId: "nope", price: 10 });
    expect(bid.status).toBe(403);
    expect(bid.body.reason).toBe("limited");
    const list = await auth(request(app).post("/marketplace"), player).send({ item: "nope", price: 10 });
    expect(list.body.reason).toBe("limited");
    const buy = await auth(request(app).post(`/marketplace/buy/${new mongoose.Types.ObjectId()}`), player);
    expect(buy.body.reason).toBe("limited");

    const cancel = await auth(request(app).delete(`/marketplace/orders/${open._id}`), player);
    expect(cancel.status).toBe(200);
    expect(cancel.body.refunded).toBe(10);
  });

  test("it cannot chat or join the rain until lifted", async () => {
    const admin = await makeUser({ isAdmin: true });
    const player = await makeUser({ googleId: `g-${uniqueSuffix()}` });
    await limit(admin, player, "review");

    expect((await chat.send(player._id, "hello")).error).toBe("limited");
    expect((await rain.join(player._id)).error).toBe("limited");

    await lift(admin, player);
    expect((await chat.send(player._id, "hello")).error).toBeUndefined();
    expect((await rain.join(player._id)).error).toBeUndefined();
  });

  test("the board leaves it out while limited and counts it again once lifted", async () => {
    const admin = await makeUser({ isAdmin: true });
    const big = await makeUser({ googleId: `g-${uniqueSuffix()}` });
    const small = await makeUser({ googleId: `g-${uniqueSuffix()}` });
    const { startsAt, endsAt } = leaderboard.windowFor();
    const mid = new Date(startsAt.getTime() + 60 * 1000);
    for (const [u, amount] of [[big, 5000], [small, 1000]]) {
      await Transaction.create({ userId: u._id, type: TX.CASE_OPEN, direction: "debit", amount, balanceAfter: 0, meta: {}, createdAt: mid });
    }
    const ranked = async () => (await leaderboard.standings(startsAt, endsAt)).map((r) => String(r._id));

    await limit(admin, big, "review");
    expect(await ranked()).toEqual([String(small._id)]);
    const board = await auth(request(app).get("/leaderboard"), big);
    expect(board.body.me).toMatchObject({ limited: true, rank: null });

    await lift(admin, big);
    expect(await ranked()).toEqual([String(big._id), String(small._id)]);
  });
});

describe("referrals while limited", () => {
  test("a limited referrer's bonus waits for the lift, then pays once", async () => {
    const admin = await makeUser({ isAdmin: true });
    const referrer = await makeUser({ walletBalance: 0 });
    await limit(admin, referrer, "review");
    const referee = await makeUser({ level: 1, referredBy: referrer._id, referralBonusPending: true, emailVerifiedAt: new Date() });

    await settleOnVerified(referee._id);
    expect((await User.findById(referrer._id)).walletBalance).toBe(0);
    expect((await User.findById(referee._id)).referralBonusPending).toBe(true);

    await lift(admin, referrer);
    await lift(admin, referrer);
    expect((await User.findById(referrer._id)).walletBalance).toBe(REFERRER_SIGNUP_BONUS);
    expect(await Transaction.countDocuments({ userId: referrer._id, type: TX.REFERRAL_BONUS })).toBe(1);
  });

  test("a milestone reached while the referee is limited is paid when the limit lifts", async () => {
    const admin = await makeUser({ isAdmin: true });
    const referrer = await makeUser({ walletBalance: 0 });
    const referee = await makeUser({ level: MILESTONE_LEVEL, referredBy: referrer._id, googleId: `g-${uniqueSuffix()}` });
    await limit(admin, referee, "review");

    await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL);
    expect((await User.findById(referrer._id)).walletBalance).toBe(0);

    await lift(admin, referee);
    expect((await User.findById(referrer._id)).walletBalance).toBe(MILESTONE_BONUS);
    expect((await User.findById(referee._id)).referralMilestonePaid).toBe(true);
  });

  test("a limited referee stops earning commission from the day of the limit, and keeps what came before", async () => {
    const admin = await makeUser({ isAdmin: true });
    const referrer = await makeUser();
    const referee = await makeUser({ referredBy: referrer._id, emailVerifiedAt: new Date() });
    await Transaction.create({ userId: referee._id, type: TX.CRASH_BET, direction: "debit", amount: 3000, createdAt: new Date(Date.now() - 3 * DAY) });
    await Transaction.create({ userId: referee._id, type: TX.CRASH_BET, direction: "debit", amount: 5000 });
    const commission = async () => (await auth(request(app).get("/referrals/me"), referrer)).body.referrals[0].commission;

    await limit(admin, referee, "review");
    expect(await commission()).toBe(Math.floor(3000 * COMMISSION_RATE));

    await lift(admin, referee);
    expect(await commission()).toBe(Math.floor(8000 * COMMISSION_RATE));
  });

  test("a limited account cannot claim its commission", async () => {
    const admin = await makeUser({ isAdmin: true });
    const referrer = await makeUser();
    const referee = await makeUser({ referredBy: referrer._id, emailVerifiedAt: new Date() });
    await Transaction.create({ userId: referee._id, type: TX.CRASH_BET, direction: "debit", amount: 5000 });
    await limit(admin, referrer, "review");

    const claim = await auth(request(app).post("/referrals/claim"), referrer);
    expect(claim.status).toBe(403);
    expect(claim.body.reason).toBe("limited");
  });
});

describe("the backoffice view of an account", () => {
  test("lists the other accounts seen on the same address, and only those", async () => {
    const admin = await makeUser({ isAdmin: true });
    const a = await makeUser();
    const b = await makeUser({ discordId: `d-${uniqueSuffix()}` });
    const c = await makeUser();
    const now = new Date();
    await IpSighting.create([
      { userId: a._id, ipHash: "sharedhash00000000000a", firstAt: now, lastAt: now },
      { userId: b._id, ipHash: "sharedhash00000000000a", firstAt: now, lastAt: now },
      { userId: a._id, ipHash: "alonehash000000000000b", firstAt: now, lastAt: now },
      { userId: c._id, ipHash: "otherhash000000000000c", firstAt: now, lastAt: now },
    ]);

    const res = await auth(request(app).get(`/admin/users/${a._id}/account`), admin);
    expect(res.status).toBe(200);
    expect(res.body.addresses).toBe(2);
    expect(res.body.shared).toHaveLength(1);
    expect(res.body.shared[0].hash).toBe("sharedha");
    expect(res.body.shared[0].accounts.map((x) => [x.username, x.verified])).toEqual([[b.username, true]]);
    expect(res.body.verification).toMatchObject({ verified: false, email: a.email });

    expect((await auth(request(app).get(`/admin/users/${a._id}/account`), a)).status).toBe(403);
  });
});
