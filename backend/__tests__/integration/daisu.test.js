process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const pot = require("../../utils/pot");
const { chargeUser, TX } = require("../../utils/economy");
const { MINT } = require("../../utils/accounts");

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
// a bonus clock on each of these games, running out this many minutes from now
const clockFor = (mins, ...games) => Object.fromEntries(games.map((g) => [g, new Date(Date.now() + minutes(mins))]));

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
  it("says how full it is, what a take pays now, and where the pick stands", async () => {
    const user = await makeUser({ level: 9, bonusAmount: 380, nextBonus: fillingFor(4), potPickIndex: 2, potCycleClaimed: 190 });

    const res = await status(user);

    expect(res.status).toBe(200);
    expect(res.body.fill).toBeCloseTo(0.5, 1);
    expect(res.body.full).toBe(380);
    expect(res.body.amount).toBe(pot.payout(380, res.body.fill));
    expect(res.body.clickRate).toBe(pot.CLICK_RATE);
    expect(res.body.fullBonus).toBeCloseTo(0.25);
    expect(res.body.pick).toBe(pot.PICKS[2]);
    expect(res.body.nextPick).toBe(pot.PICKS[3]);
    expect(res.body.pickProgress).toBeCloseTo(0.5);
    expect(res.body.creditTtlMs).toBe(pot.CREDIT_TTL_MS);
    expect(res.body.bonuses).toEqual([]);
  });
});

describe("taking from the pot", () => {
  it("pays the whole pot when it is full, plus a tenth as credit on the pick", async () => {
    const user = await makeUser({ level: 0, bonusAmount: 1000, nextBonus: fillingFor(60) });

    const res = await claim(user);

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(1000);
    expect(res.body.credit).toBe(100);
    expect(res.body.pick).toBe(pot.PICKS[0]);
    expect(res.body.pickChanged).toBe(true);
    expect(res.body.walletBalance).toBe(1000);
    expect(res.body.status.bonuses).toMatchObject([{ game: pot.PICKS[0], amount: 100, expired: false }]);
    expect(res.body.status.pick).toBe(pot.PICKS[1]);

    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(1000);
    expect(after.gameCredits[pot.PICKS[0]]).toBe(100);
    expect(new Date(after.gameCreditsExpireAt[pot.PICKS[0]]).getTime()).toBeGreaterThan(Date.now() + minutes(7));
    expect(after.bonusAmount).toBe(pot.fullAmount(0));
    expect(after.potPickIndex).toBe(1);
    expect(after.potCycleClaimed).toBe(0);
    expect(new Date(after.nextBonus).getTime()).toBeGreaterThan(Date.now() + minutes(7));

    const rows = await Transaction.find({ userId: user._id }).sort({ amount: -1 }).lean();
    expect(rows.map((r) => [r.type, r.amount])).toEqual([
      [TX.BONUS, 1000],
      [TX.GAME_CREDIT, 100],
    ]);
    expect(rows[1].meta.game).toBe(pot.PICKS[0]);
  });

  it("pays an early take at the click rate and restarts the fill from there", async () => {
    const user = await makeUser({ level: 40, bonusAmount: 1000, nextBonus: fillingFor(4) });

    const res = await claim(user);

    expect(res.status).toBe(200);
    expect(res.body.amount).toBeGreaterThan(440);
    expect(res.body.amount).toBeLessThan(460);
    expect(res.body.credit).toBeCloseTo(res.body.amount / 10, 1);
    expect(res.body.pickChanged).toBe(false);
    expect(res.body.status.fill).toBe(0);
    expect(res.body.status.pickProgress).toBeCloseTo(res.body.amount / 1000);
  });

  it("keeps the tenth on one game until a whole pot has been taken", async () => {
    const user = await makeUser({ level: 15, bonusAmount: 500, nextBonus: fillingFor(4), potCycleClaimed: 400 });

    const res = await claim(user);

    expect(res.body.pick).toBe(pot.PICKS[0]);
    expect(res.body.pickChanged).toBe(true);
    const after = await User.findById(user._id).lean();
    expect(after.potPickIndex).toBe(1);
    expect(after.potCycleClaimed).toBeCloseTo(400 + res.body.amount - 500);
    expect(after.gameCredits[pot.PICKS[0]]).toBeCloseTo(res.body.credit);
  });

  it("finds nothing in a pot that was just taken and says when there will be", async () => {
    const user = await makeUser({ bonusAmount: 500, nextBonus: fillingFor(0.01) });

    const res = await claim(user);

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("empty");
    expect(new Date(res.body.readyAt).getTime()).toBeGreaterThan(Date.now());
    expect((await User.findById(user._id).lean()).walletBalance).toBe(0);
  });

  it("pays two requests that land together once", async () => {
    const user = await makeUser({ bonusAmount: 500, nextBonus: fillingFor(60) });

    const [a, b] = await Promise.all([claim(user), claim(user)]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await User.findById(user._id).lean()).walletBalance).toBe(500);
  });

  it("sizes the next pot from the level at the time of the take", async () => {
    const user = await makeUser({ level: 25, bonusAmount: 1000, nextBonus: fillingFor(60) });

    await claim(user);

    expect((await User.findById(user._id).lean()).bonusAmount).toBe(700);
  });
});

describe("spending a credit", () => {
  it("goes first on its own game, with the wallet covering the rest", async () => {
    const user = await makeUser({ walletBalance: 100, gameCredits: { dice: 60 }, gameCreditsExpireAt: clockFor(5, "dice") });

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
    const user = await makeUser({ walletBalance: 100, gameCredits: { dice: 60 }, gameCreditsExpireAt: clockFor(5, "dice") });

    await chargeUser(user._id, 40, { type: TX.DICE_BET });

    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(100);
    expect(after.gameCredits.dice).toBe(20);
  });

  it("spends a credit held to the cent", async () => {
    const user = await makeUser({ walletBalance: 100, gameCredits: { dice: 4.5 }, gameCreditsExpireAt: clockFor(5, "dice") });

    const charged = await chargeUser(user._id, 10, { type: TX.DICE_BET });

    expect(charged.walletBalance).toBeCloseTo(94.5);
    const after = await User.findById(user._id).lean();
    expect(after.gameCredits.dice).toBe(0);
  });

  it("is no use on any other game", async () => {
    const user = await makeUser({ walletBalance: 100, gameCredits: { dice: 60 }, gameCreditsExpireAt: clockFor(5, "dice") });

    const charged = await chargeUser(user._id, 80, { type: TX.SLOT_BET });

    expect(charged.walletBalance).toBe(20);
    const after = await User.findById(user._id).lean();
    expect(after.gameCredits.dice).toBe(60);
    const [row] = await Transaction.find({ userId: user._id }).lean();
    expect(row.meta && row.meta.credit).toBeUndefined();
  });

  it("refuses a stake that wallet and credit together cannot cover", async () => {
    const user = await makeUser({ walletBalance: 100, gameCredits: { dice: 60 }, gameCreditsExpireAt: clockFor(5, "dice") });

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
    const user = await makeUser({ walletBalance: 10, gameCredits: { dice: 60 }, gameCreditsExpireAt: clockFor(5, "dice") });

    expect(await chargeUser(user._id, 50, { type: TX.BATTLE_ENTRY })).toBeNull();
  });
});

describe("a bonus running out", () => {
  it("pays for nothing once it has expired, and stays put for the next take to burn", async () => {
    const user = await makeUser({ walletBalance: 100, gameCredits: { dice: 60 }, gameCreditsExpireAt: clockFor(-1, "dice") });

    const charged = await chargeUser(user._id, 40, { type: TX.DICE_BET });

    expect(charged.walletBalance).toBe(60);
    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(60);
    expect(after.gameCredits.dice).toBe(60);
    const [row] = await Transaction.find({ userId: user._id }).lean();
    expect(row.meta && row.meta.credit).toBeUndefined();
  });

  it("counts a credit from before the clock as expired", async () => {
    const user = await makeUser({ walletBalance: 10, gameCredits: { dice: 60 } });

    expect(await chargeUser(user._id, 50, { type: TX.DICE_BET })).toBeNull();
  });

  it("says when each bonus runs out, and keeps an expired one listed until the next take", async () => {
    const user = await makeUser({ gameCredits: { dice: 20, hilo: 5 }, gameCreditsExpireAt: { ...clockFor(3, "dice"), ...clockFor(-1, "hilo") } });

    const res = await status(user);

    expect(res.body.bonuses.map((b) => [b.game, b.amount, b.expired])).toEqual([
      ["dice", 20, false],
      ["hilo", 5, true],
    ]);
    expect(Date.parse(res.body.bonuses[0].expiresAt)).toBeGreaterThan(Date.now() + minutes(2));
  });

  it("restarts its clock whenever a take adds to it", async () => {
    const user = await makeUser({
      bonusAmount: 1000,
      nextBonus: fillingFor(60),
      potPickIndex: 1,
      gameCredits: { dice: 50 },
      gameCreditsExpireAt: clockFor(2, "dice"),
    });

    const res = await claim(user);

    expect(res.status).toBe(200);
    const after = await User.findById(user._id).lean();
    expect(after.gameCredits.dice).toBe(150);
    expect(new Date(after.gameCreditsExpireAt.dice).getTime()).toBeGreaterThan(Date.now() + minutes(7));
    expect(res.body.status.bonuses[0]).toMatchObject({ game: "dice", amount: 150, expired: false });
    expect(await Transaction.countDocuments({ userId: user._id, type: TX.GAME_CREDIT_EXPIRED })).toBe(0);
  });

  it("goes back to the mint with the next take, and an expired pick starts over from the new credit", async () => {
    const user = await makeUser({
      bonusAmount: 1000,
      nextBonus: fillingFor(60),
      potPickIndex: 1,
      gameCredits: { slots: 30, dice: 50, mines: 20 },
      gameCreditsExpireAt: { ...clockFor(-3, "slots", "dice"), ...clockFor(4, "mines") },
    });

    const res = await claim(user);

    expect(res.status).toBe(200);
    const after = await User.findById(user._id).lean();
    expect(after.gameCredits).toMatchObject({ slots: 0, dice: 100, mines: 20 });
    const burned = await Transaction.find({ userId: user._id, type: TX.GAME_CREDIT_EXPIRED }).sort({ amount: 1 }).lean();
    expect(burned.map((r) => [r.meta.game, r.amount, r.direction])).toEqual([
      ["slots", 30, "debit"],
      ["dice", 50, "debit"],
    ]);
    expect(String(burned[0].counterparty)).toBe(String(MINT));
    expect(res.body.status.bonuses.map((b) => b.game)).toEqual(["dice", "mines"]);
  });
});

describe("the pot with her perks", () => {
  const holding = (keys, fields = {}) => makeUser({ unlocks: keys.map((key) => ({ key, via: "bought", at: new Date() })), ...fields });

  it("adds fifteen percent of a take for a golden ticket holder", async () => {
    const user = await holding(["goldenTicket"], { level: 0, bonusAmount: 1000, nextBonus: fillingFor(60) });

    expect((await status(user)).body.creditShare).toBe(0.15);
    const res = await claim(user);
    expect(res.body.amount).toBe(1000);
    expect(res.body.credit).toBe(150);
  });

  it("changes nothing for an account without them", async () => {
    const user = await makeUser({ level: 0, bonusAmount: 1000, nextBonus: fillingFor(60) });
    const res = await claim(user);
    expect(res.body.credit).toBe(100);
    expect(res.body.status.cycleMs).toBe(pot.CYCLE_MS);
  });
});
