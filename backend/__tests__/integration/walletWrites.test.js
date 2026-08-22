process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const { chargeUser, creditUser, awardXp, TX } = require("../../utils/economy");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

// a wallet write used to hand the whole document back: two megabytes for the deepest
// account on production, 20.5 seconds against 31 ms without it, and a bet does two.
const deepUser = async (entries = 200) => {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    walletBalance: 1000,
    inventory: Array.from({ length: entries }, () => ({ rarity: "1" })),
  });
};

const heldBy = async (id) => (await User.findById(id).lean()).inventory.length;

describe("a wallet write", () => {
  it("does not carry the inventory back with the balance", async () => {
    const user = await deepUser();

    const charged = await chargeUser(user._id, 100, { type: TX.PLINKO_BET, meta: {} });
    expect(charged.walletBalance).toBe(900);
    expect(charged.inventory).toBeUndefined();

    const credited = await creditUser(user._id, 250, 250, { type: TX.PLINKO_WIN, meta: {} });
    expect(credited.walletBalance).toBe(1150);
    expect(credited.inventory).toBeUndefined();

    const levelled = await awardXp(user._id, 5000);
    expect(levelled.xp).toBe(5500);
    expect(levelled.inventory).toBeUndefined();
  });

  it("leaves the stored inventory alone while doing it", async () => {
    const user = await deepUser(37);

    await chargeUser(user._id, 10, { type: TX.PLINKO_BET, meta: {} });
    await creditUser(user._id, 10, 0, { type: TX.PLINKO_WIN, meta: {} });
    await awardXp(user._id, 10);

    expect(await heldBy(user._id)).toBe(37);
  });

  it("still refuses a charge the balance cannot cover", async () => {
    const user = await deepUser(5);
    expect(await chargeUser(user._id, 5000, { type: TX.PLINKO_BET, meta: {} })).toBeNull();
    expect((await User.findById(user._id)).walletBalance).toBe(1000);
  });
});
