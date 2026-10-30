process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DISCORD_BOT_SECRET = "bot-secret-for-tests";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Coupon = require("../../models/Coupon");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");
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
  return User.create({ username: `Rio ${s}`, slug: `rio-${s}`, email: `c${s}@k.co`, walletBalance: 100, emailVerifiedAt: new Date(), ...fields });
};

const as = (user, req) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const redeem = (user, code) => as(user, request(app).post("/coupons/redeem").send({ code }));
const coupon = (fields = {}) =>
  Coupon.create({ code: "KANIDROP42", amount: 500, maxRedemptions: 25, expiresAt: new Date(Date.now() + 3600000), source: "admin", ...fields });
const walletOf = async (user) => (await User.findById(user._id).lean()).walletBalance;
const drop = () => request(app).post("/discord/coupons").set("x-bot-secret", process.env.DISCORD_BOT_SECRET);

// the lock date is in the future for the whole suite; a test that needs the lock on moves it for itself
const withVerifyLock = async (fn) => {
  const before = process.env.VERIFY_REQUIRED_FROM;
  process.env.VERIFY_REQUIRED_FROM = new Date(Date.now() - 60000).toISOString();
  try {
    await fn();
  } finally {
    process.env.VERIFY_REQUIRED_FROM = before;
  }
};

describe("redeeming a coupon", () => {
  it("pays the amount once, from the mint, forgiving case and dashes", async () => {
    await coupon();
    const user = await makeUser();

    const first = await redeem(user, "kani-drop-42");
    const again = await redeem(user, "KANIDROP42");

    expect(first.status).toBe(200);
    expect(first.body).toEqual({ redeemed: true, amount: 500, walletBalance: 600 });
    expect(again.status).toBe(409);
    expect(again.body.reason).toBe("already");
    expect(await walletOf(user)).toBe(600);
    const rows = await Transaction.find({ userId: user._id, type: TX.COUPON }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].meta.code).toBe("KANIDROP42");
    expect(String(rows[0].counterparty)).toBe(String(MINT));
  });

  it("stops at its cap, even when everyone redeems at once", async () => {
    await coupon({ maxRedemptions: 2 });
    const players = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser()));

    const answers = await Promise.all(players.map((p) => redeem(p, "KANIDROP42")));

    expect(answers.filter((r) => r.status === 200)).toHaveLength(2);
    expect(answers.filter((r) => r.status !== 200).every((r) => r.body.reason === "usedUp" || r.body.reason === "retry")).toBe(true);
    expect(await Transaction.countDocuments({ type: TX.COUPON })).toBe(2);
    expect((await Coupon.findOne({ code: "KANIDROP42" }).lean()).redeemed).toBe(2);
  });

  it("pays one account once when it redeems twice at the same moment", async () => {
    await coupon();
    const user = await makeUser();

    await Promise.all([redeem(user, "KANIDROP42"), redeem(user, "KANIDROP42"), redeem(user, "KANIDROP42")]);

    expect(await walletOf(user)).toBe(600);
    expect(await Transaction.countDocuments({ userId: user._id, type: TX.COUPON })).toBe(1);
  });

  it("says why a code pays nothing: unknown, expired, switched off", async () => {
    const user = await makeUser();
    await coupon({ code: "OLDCODE1", expiresAt: new Date(Date.now() - 1000) });
    await coupon({ code: "OFFCODE1", disabledAt: new Date() });

    expect((await redeem(user, "NOSUCHCODE")).body.reason).toBe("unknown");
    expect((await redeem(user, "OLDCODE1")).body).toMatchObject({ reason: "expired" });
    expect((await redeem(user, "OFFCODE1")).body).toMatchObject({ reason: "off" });
    expect(await walletOf(user)).toBe(100);
  });

  it("is for the accounts the rain pays: verified and not limited", async () => {
    await coupon();
    await withVerifyLock(async () => {
      const unverified = await makeUser({ emailVerifiedAt: null });
      const res = await redeem(unverified, "KANIDROP42");
      expect(res.status).toBe(403);
      expect(res.body.reason).toBe("verify");
    });
    const limited = await makeUser({ limited: { at: new Date(), reason: "alts" } });
    expect((await redeem(limited, "KANIDROP42")).body.reason).toBe("limited");
    expect(await Transaction.countDocuments({ type: TX.COUPON })).toBe(0);
  });
});

describe("the bot's daily drop", () => {
  afterEach(() => {
    delete process.env.COUPON_DROP_AMOUNT;
    delete process.env.COUPON_DROPS_PER_DAY;
  });

  it("is refused without the bot secret", async () => {
    const res = await request(app).post("/discord/coupons").set("x-bot-secret", "not-the-secret-at-all");
    expect(res.status).toBe(403);
    expect(await Coupon.countDocuments()).toBe(0);
  });

  it("drops one random code a day on the server's terms, never the bot's", async () => {
    process.env.COUPON_DROP_AMOUNT = "750";

    const first = await drop().send({ amount: 999999 });
    const second = await drop();

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ amount: 750, maxRedemptions: 25, source: "discord", redeemed: 0 });
    expect(first.body.code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    expect(new Date(first.body.expiresAt).getTime() - Date.now()).toBeGreaterThan(59 * 60000);
    expect(second.status).toBe(409);
    expect(second.body.reason).toBe("dropped");
    expect(await Coupon.countDocuments()).toBe(1);
  });

  it("pays 1,000 K₽ for three hours unless the server says otherwise", async () => {
    const res = await drop();
    expect(res.body).toMatchObject({ amount: 1000, maxRedemptions: 25 });
    const left = new Date(res.body.expiresAt).getTime() - Date.now();
    expect(left).toBeGreaterThan(179 * 60000);
    expect(left).toBeLessThanOrEqual(180 * 60000);
  });

  it("lands once when two drops race for the same day", async () => {
    const answers = await Promise.all([drop(), drop(), drop()]);
    expect(answers.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await Coupon.countDocuments()).toBe(1);
  });
});

describe("coupons in the backoffice", () => {
  it("lets staff make a code, see it and switch it off, and nobody else", async () => {
    const admin = await makeUser({ isAdmin: true });
    const player = await makeUser();

    expect((await as(player, request(app).post("/admin/coupons").send({ amount: 100, maxRedemptions: 5, minutes: 30 }))).status).toBe(403);
    const made = await as(admin, request(app).post("/admin/coupons").send({ amount: 100, maxRedemptions: 5, minutes: 30, code: "doto-week" }));
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ code: "DOTOWEEK", amount: 100, source: "admin" });
    expect((await as(admin, request(app).post("/admin/coupons").send({ amount: 100, maxRedemptions: 5, minutes: 30, code: "DOTOWEEK" }))).status).toBe(409);
    expect((await as(admin, request(app).post("/admin/coupons").send({ amount: 0, maxRedemptions: 5, minutes: 30 }))).status).toBe(400);

    const list = await as(admin, request(app).get("/admin/coupons"));
    expect(list.body.coupons.map((c) => c.code)).toEqual(["DOTOWEEK"]);
    expect(list.body.coupons[0].redeemedBy).toBeUndefined();

    const off = await as(admin, request(app).post(`/admin/coupons/${made.body.id}/disable`));
    expect(off.status).toBe(200);
    expect(off.body.disabledAt).toBeTruthy();
    expect((await redeem(player, "DOTOWEEK")).body.reason).toBe("off");
  });
});
