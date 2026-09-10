process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const pot = require("../../utils/pot");
const { chargeUser, TX } = require("../../utils/economy");
const { dayIndex } = require("../../utils/dailyGift");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const minutes = (n) => n * 60000;

const makeUser = (fields = {}) => {
  const s = uniqueSuffix();
  return User.create({
    username: `Nova ${s}`,
    slug: `nova-${s}`,
    email: `u${s}@k.co`,
    betaFlags: ["daisu"],
    walletBalance: 0,
    ...fields,
  });
};

// a pot that has been filling for this many minutes
const fillingFor = (mins) => new Date(Date.now() - minutes(mins) + pot.CYCLE_MS);

const status = (user) => request(app).get("/daisu/status").set("Authorization", `Bearer ${tokenFor(user)}`);
const claim = (user) => request(app).post("/daisu/claim").set("Authorization", `Bearer ${tokenFor(user)}`);

describe("who gets in", () => {
  it("turns away an account that is not in the beta", async () => {
    const user = await makeUser({ betaFlags: [] });

    const res = await status(user);

    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("beta");
  });

  it("lets everyone in once the env switch is flipped", async () => {
    process.env.BETA_OPEN_DAISU = "1";
    try {
      const user = await makeUser({ betaFlags: [] });
      expect((await status(user)).status).toBe(200);
    } finally {
      delete process.env.BETA_OPEN_DAISU;
    }
  });

  it("tells the app which features this account has", async () => {
    const user = await makeUser();

    const res = await request(app).get("/users/me").set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.body.features).toEqual({ daisu: true });
  });

  it("lets an admin put someone in and take them out", async () => {
    const admin = await makeUser({ isAdmin: true });
    const user = await makeUser({ betaFlags: [] });

    const on = await request(app)
      .put(`/admin/users/${user._id}/beta`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ flag: "daisu", on: true });
    expect(on.body.betaFlags).toEqual(["daisu"]);
    expect((await status(user)).status).toBe(200);

    const off = await request(app)
      .put(`/admin/users/${user._id}/beta`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ flag: "daisu", on: false });
    expect(off.body.betaFlags).toEqual([]);
    expect((await status(user)).status).toBe(403);
  });
});

describe("reading the pot", () => {
  it("says how full it is and what a claim would pay right now", async () => {
    const user = await makeUser({ level: 9, bonusAmount: 380, nextBonus: fillingFor(4) });

    const res = await status(user);

    expect(res.status).toBe(200);
    expect(res.body.fill).toBeCloseTo(0.5, 1);
    expect(res.body.full).toBe(380);
    expect(res.body.amount).toBe(pot.payout(380, res.body.fill));
    expect(res.body.floor).toBe(pot.FLOOR);
    expect(pot.PICKS).toContain(res.body.pick);
    expect(res.body.credits).toEqual({});
  });
});

describe("claiming", () => {
  it("pays the whole pot when it is full, plus a tenth as credit on the pick of the day", async () => {
    const user = await makeUser({ level: 0, bonusAmount: 1000, nextBonus: fillingFor(60) });

    const res = await claim(user);

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(1000);
    expect(res.body.credit).toBe(100);
    expect(res.body.pick).toBe(pot.pickFor(dayIndex(new Date())));
    expect(res.body.walletBalance).toBe(1000);
    expect(res.body.status.credits).toEqual({ [res.body.pick]: 100 });

    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(1000);
    expect(after.gameCredits[res.body.pick]).toBe(100);
    expect(after.bonusAmount).toBe(pot.fullAmount(0));
    expect(new Date(after.nextBonus).getTime()).toBeGreaterThan(Date.now() + minutes(7));

    const rows = await Transaction.find({ userId: user._id }).sort({ amount: -1 }).lean();
    expect(rows.map((r) => [r.type, r.amount])).toEqual([
      [TX.BONUS, 1000],
      [TX.GAME_CREDIT, 100],
    ]);
    expect(rows[1].meta.game).toBe(res.body.pick);
  });

  it("pays a part of it before it is full, and restarts the fill from there", async () => {
    const user = await makeUser({ bonusAmount: 500, nextBonus: fillingFor(4) });

    const res = await claim(user);

    expect(res.status).toBe(200);
    expect(res.body.amount).toBeLessThan(250);
    expect(res.body.amount).toBeGreaterThan(200);
    expect(res.body.status.fill).toBe(0);
  });

  it("finds nothing in an empty pot and says when there will be", async () => {
    const user = await makeUser({ bonusAmount: 500, nextBonus: fillingFor(0.2) });

    const res = await claim(user);

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("empty");
    expect(new Date(res.body.floorAt).getTime()).toBeGreaterThan(Date.now());
    expect((await User.findById(user._id).lean()).walletBalance).toBe(0);
  });

  it("pays two clicks that land together once", async () => {
    const user = await makeUser({ bonusAmount: 500, nextBonus: fillingFor(60) });

    const [a, b] = await Promise.all([claim(user), claim(user)]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await User.findById(user._id).lean()).walletBalance).toBe(500);
  });

  it("sizes the next pot from the level at the time of the claim", async () => {
    const user = await makeUser({ level: 25, bonusAmount: 1000, nextBonus: fillingFor(60) });

    await claim(user);

    expect((await User.findById(user._id).lean()).bonusAmount).toBe(700);
  });
});

describe("spending a credit", () => {
  it("goes first on its own game, with the wallet covering the rest", async () => {
    const user = await makeUser({ walletBalance: 100, gameCredits: { dice: 60 } });

    const charged = await chargeUser(user._id, 150, { type: TX.DICE_BET, meta: { note: 1 } });

    expect(charged.walletBalance).toBe(10);
    expect(charged.gameCredits.dice).toBe(0);
    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(10);
    expect(after.gameCredits.dice).toBe(0);
    expect(after.xp).toBe(750);
    const [row] = await Transaction.find({ userId: user._id }).lean();
    expect(row.amount).toBe(150);
    expect(row.balanceAfter).toBe(10);
    expect(row.meta).toEqual({ note: 1, credit: 60 });
  });

  it("leaves the wallet alone while the credit covers the whole stake", async () => {
    const user = await makeUser({ walletBalance: 100, gameCredits: { dice: 60 } });

    await chargeUser(user._id, 40, { type: TX.DICE_BET });

    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(100);
    expect(after.gameCredits.dice).toBe(20);
  });

  it("is no use on any other game", async () => {
    const user = await makeUser({ walletBalance: 100, gameCredits: { dice: 60 } });

    const charged = await chargeUser(user._id, 80, { type: TX.SLOT_BET });

    expect(charged.walletBalance).toBe(20);
    const after = await User.findById(user._id).lean();
    expect(after.gameCredits.dice).toBe(60);
    const [row] = await Transaction.find({ userId: user._id }).lean();
    expect(row.meta && row.meta.credit).toBeUndefined();
  });

  it("refuses a stake that wallet and credit together cannot cover", async () => {
    const user = await makeUser({ walletBalance: 100, gameCredits: { dice: 60 } });

    expect(await chargeUser(user._id, 161, { type: TX.DICE_BET })).toBeNull();
    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(100);
    expect(after.gameCredits.dice).toBe(60);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(0);
  });

  it("charges an account that never held a credit exactly as before", async () => {
    const user = await makeUser({ walletBalance: 100 });

    const charged = await chargeUser(user._id, 30, { type: TX.MINES_BET, awardXp: false });

    expect(charged.walletBalance).toBe(70);
    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(70);
    expect(after.xp).toBe(0);
  });

  it("does not let a case opening or a battle touch it", async () => {
    const user = await makeUser({ walletBalance: 10, gameCredits: { dice: 60 } });

    expect(await chargeUser(user._id, 50, { type: TX.BATTLE_ENTRY })).toBeNull();
  });
});
