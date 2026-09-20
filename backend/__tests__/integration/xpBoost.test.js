process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Migration = require("../../models/Migration");
const { chargeUser, TX, calculateXPForLevel } = require("../../utils/economy");
const { oldXpForLevel, xpForLevel } = require("../../utils/xpCurve");
const { migrateXpCurve } = require("../../scripts/migrateXpCurve");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (fields = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `Xp ${s}`, slug: `xp-${s}`, email: `x${s}@k.co`, password: "x", walletBalance: 100000, ...fields });
};

describe("xp on a charge", () => {
  it("earns five xp per K₽ with nothing held", async () => {
    const user = await makeUser();
    const after = await chargeUser(user._id, 100, { type: TX.DICE_BET });
    expect(after.xp).toBe(500);
    expect((await User.findById(user._id).lean()).xp).toBe(500);
  });

  it("multiplies by the boosts held, and the charm only on its own game", async () => {
    const user = await makeUser({ xpBoost: { all: 1.35, dice: 0.25 } });
    await chargeUser(user._id, 100, { type: TX.DICE_BET });
    expect((await User.findById(user._id).lean()).xp).toBe(800);
    await chargeUser(user._id, 100, { type: TX.CRASH_BET });
    expect((await User.findById(user._id).lean()).xp).toBe(800 + 675);
    // a game that takes pot credit goes through the other write, with the same maths
    await chargeUser(user._id, 100, { type: TX.SLOT_BET });
    expect((await User.findById(user._id).lean()).xp).toBe(800 + 675 + 675);
  });

  it("levels up on the new ladder, and never levels down", async () => {
    const user = await makeUser({ xp: 0, level: 0 });
    await chargeUser(user._id, 40, { type: TX.DICE_BET });
    expect((await User.findById(user._id).lean()).level).toBe(1);

    const high = await makeUser({ xp: 10, level: 50 });
    await chargeUser(high._id, 10, { type: TX.DICE_BET });
    expect((await User.findById(high._id).lean()).level).toBe(50);
  });
});

describe("carrying every account over at boot", () => {
  it("keeps each level, runs once, and marks that it ran", async () => {
    const a = await makeUser({ level: 30, xp: oldXpForLevel(30) + 100 });
    const b = await makeUser({ level: 10, xp: oldXpForLevel(10) });
    const c = await makeUser({ level: 0, xp: 300 });

    expect(await migrateXpCurve()).toMatchObject({ ran: true, touched: 3 });
    const after = await User.find({ _id: { $in: [a._id, b._id, c._id] } }, { xp: 1, level: 1 }).lean();
    const byId = Object.fromEntries(after.map((u) => [String(u._id), u]));
    expect(byId[a._id].level).toBe(30);
    expect(byId[a._id].xp).toBeGreaterThanOrEqual(xpForLevel(30));
    expect(byId[a._id].xp).toBeLessThan(xpForLevel(31));
    expect(byId[b._id].xp).toBe(xpForLevel(10));
    expect(byId[c._id].xp).toBeLessThan(calculateXPForLevel(1));

    expect(await migrateXpCurve()).toEqual({ ran: false });
    expect(await Migration.countDocuments()).toBe(1);
  });
});
