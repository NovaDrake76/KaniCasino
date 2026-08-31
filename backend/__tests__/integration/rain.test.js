process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.RAIN_MIN_POOL = "100";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const RainRound = require("../../models/RainRound");
const Transaction = require("../../models/Transaction");
const rain = require("../../utils/rain");
const { TX } = require("../../utils/economy");
const { HOUSE } = require("../../utils/accounts");

beforeAll(setupDb);
afterEach(async () => {
  await clearDb();
  rain.resetCache();
});
afterAll(teardownDb);

const makeUser = (over = {}) =>
  User.create({
    username: `r${uniqueSuffix()}`,
    email: `r${uniqueSuffix()}@k.co`,
    password: "x",
    level: 10,
    walletBalance: 0,
    ...over,
  });

// a stake row inside the open round, which is what the pool is derived from
const wager = (userId, amount, at = new Date()) =>
  Transaction.create({
    userId, type: TX.CRASH_BET, direction: "debit", amount, balanceAfter: 0, createdAt: at,
  });

describe("what the pool is worth", () => {
  it("is a share of what the site wagered in the window", async () => {
    const u = await makeUser();
    const round = await rain.currentRound();
    await wager(u._id, 100000);

    expect(await rain.poolFor(round)).toBe(Math.floor(100000 * rain.RATE));
  });

  it("counts nothing from before the round opened", async () => {
    const u = await makeUser();
    const round = await rain.currentRound();
    await wager(u._id, 100000, new Date(round.startsAt.getTime() - 60000));

    expect(await rain.poolFor(round)).toBe(0);
  });

  it("is capped, so one session cannot hand over a fortune", async () => {
    const u = await makeUser();
    const round = await rain.currentRound();
    await wager(u._id, 999999999);

    expect(await rain.poolFor(round)).toBe(rain.MAX_POOL);
  });
});

describe("joining", () => {
  it("puts a player in once, however many times they click", async () => {
    const u = await makeUser();

    await rain.join(u._id);
    const state = await rain.join(u._id);

    expect(state.joined).toBe(true);
    const round = await RainRound.findOne({ settledAt: null }).lean();
    expect(round.joiners).toHaveLength(1);
  });

  it("turns away a level too low to have cost anything", async () => {
    const u = await makeUser({ level: 0 });
    expect((await rain.join(u._id)).error).toBe("level");
  });

  it("asks more of a joiner than the chat asks of a talker, because this one pays", async () => {
    // talking costs nothing and this hands over KP, so the two gates are set apart
    const chat = require("../../utils/chat");
    expect(rain.MIN_LEVEL).toBeGreaterThan(chat.MIN_LEVEL);
  });

  it("turns away a banned account and an anonymous socket", async () => {
    const banned = await makeUser({ disabled: true });
    expect((await rain.join(banned._id)).error).toBe("banned");
    expect((await rain.join(null)).error).toBe("auth");
  });
});

describe("settling", () => {
  // put the whole window in the past so the round is due, then stake inside it. a wager
  // stamped after endsAt belongs to the next round, which is the real behaviour.
  const ripen = async () => {
    const round = await rain.currentRound();
    const endsAt = new Date(Date.now() - 1000);
    const startsAt = new Date(endsAt.getTime() - rain.INTERVAL_MS);
    await RainRound.updateOne({ _id: round._id }, { $set: { startsAt, endsAt } });
    rain.resetCache();
    return { startsAt, endsAt };
  };

  const stakeInside = async (userId, amount) => {
    const round = await RainRound.findOne({ settledAt: null }).lean();
    await wager(userId, amount, new Date(round.startsAt.getTime() + 1000));
    rain.resetCache();
  };

  it("splits the pool between everyone who joined", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await rain.join(a._id);
    await rain.join(b._id);
    await ripen();
    await stakeInside(a._id, 200000);

    const result = await rain.settle();

    // both are level 10, so the weighted split is an even one
    const expected = Math.floor(Math.floor(200000 * rain.RATE) / 2);
    expect(result.paidOut).toBe(expected * 2);
    expect((await User.findById(a._id)).walletBalance).toBe(expected);
    expect((await User.findById(b._id)).walletBalance).toBe(expected);
  });

  it("writes a ledger row against the house, not the mint", async () => {
    // it is rakeback like the daily board, so it comes out of the edge rather than
    // printing new KP
    const a = await makeUser();
    await rain.join(a._id);
    await ripen();
    await stakeInside(a._id, 200000);

    await rain.settle();

    const row = await Transaction.findOne({ userId: a._id, type: TX.RAIN_PAYOUT }).lean();
    expect(row).toBeTruthy();
    expect(String(row.counterparty)).toBe(String(HOUSE));
    expect(row.direction).toBe("credit");
  });

  it("pays nobody when nobody joined, and carries the pool into the next round", async () => {
    const a = await makeUser();
    await ripen();
    await stakeInside(a._id, 200000);

    const result = await rain.settle();

    expect(result.paidOut).toBe(0);
    const next = await rain.currentRound();
    expect(next.carriedIn).toBe(Math.floor(200000 * rain.RATE));
  });

  it("carries a pool too small to be worth splitting rather than paying dust", async () => {
    const a = await makeUser();
    await rain.join(a._id);
    await ripen();
    await stakeInside(a._id, 100);

    const result = await rain.settle();

    expect(result.paidOut).toBe(0);
    expect((await User.findById(a._id)).walletBalance).toBe(0);
  });

  it("cannot pay the same round twice", async () => {
    const a = await makeUser();
    await rain.join(a._id);
    await ripen();
    await stakeInside(a._id, 200000);

    const first = await rain.settle();
    const second = await rain.settle();

    expect(first.paidOut).toBeGreaterThan(0);
    expect(second).toBeNull();
    expect(await Transaction.countDocuments({ type: TX.RAIN_PAYOUT })).toBe(1);
  });

  it("opens the next round rather than leaving the countdown dead", async () => {
    const a = await makeUser();
    await rain.join(a._id);
    await ripen();

    await rain.settle();

    const open = await RainRound.find({ settledAt: null });
    expect(open).toHaveLength(1);
    expect(open[0].endsAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("leaves a round that has not run out alone", async () => {
    await rain.currentRound();
    expect(await rain.settle()).toBeNull();
  });
});

describe("how the pool is divided", () => {
  const person = (id, level) => ({ _id: id, level });

  it("gives a higher level a bigger share", () => {
    const shares = rain.splitPool(3000, [person("veteran", 100), person("new", 0)]);
    const [veteran, fresh] = shares;

    expect(veteran.amount).toBeGreaterThan(fresh.amount);
    // three times the weight, not a hundred times: one veteran must not take the room
    expect(rain.weightFor(100) / rain.weightFor(0)).toBe(3);
  });

  it("stops counting level past the cap, so nothing runs away", () => {
    expect(rain.weightFor(500)).toBe(rain.weightFor(rain.LEVEL_CAP));
  });

  it("never hands one player more than the cap, whatever the pool", () => {
    // the whole point: a huge session and one new joiner must not make that joiner rich
    const shares = rain.splitPool(rain.MAX_POOL, [person("lucky", 3)]);

    expect(shares[0].amount).toBe(rain.MAX_PER_PLAYER);
    expect(shares[0].amount).toBeLessThan(rain.MAX_POOL);
  });

  it("splits evenly between equals", () => {
    const shares = rain.splitPool(1000, [person("a", 20), person("b", 20)]);
    expect(shares[0].amount).toBe(shares[1].amount);
  });

  it("pays nobody out of a pool below the floor", () => {
    expect(rain.splitPool(rain.MIN_POOL - 1, [person("a", 50)])).toEqual([]);
  });

  it("never pays out more than the pool holds", () => {
    for (const count of [1, 3, 12, 40]) {
      const people = Array.from({ length: count }, (_, i) => person(`u${i}`, i * 7));
      const total = rain.splitPool(5000, people).reduce((sum, s) => sum + s.amount, 0);
      expect(total).toBeLessThanOrEqual(5000);
    }
  });
});

describe("what the cap leaves behind", () => {
  it("carries the share the cap refused into the next round", async () => {
    const a = await makeUser({ level: rain.MIN_LEVEL });
    await rain.join(a._id);
    const round = await rain.currentRound();
    const endsAt = new Date(Date.now() - 1000);
    await RainRound.updateOne(
      { _id: round._id },
      { $set: { startsAt: new Date(endsAt.getTime() - rain.INTERVAL_MS), endsAt } }
    );
    rain.resetCache();
    await Transaction.create({
      userId: a._id, type: TX.CRASH_BET, direction: "debit",
      amount: 2000000, balanceAfter: 0,
      createdAt: new Date(endsAt.getTime() - rain.INTERVAL_MS + 1000),
    });
    rain.resetCache();

    const result = await rain.settle();

    expect(result.paidOut).toBe(rain.MAX_PER_PLAYER);
    expect(result.pool).toBeGreaterThan(rain.MAX_PER_PLAYER);
    const next = await rain.currentRound();
    expect(next.carriedIn).toBe(result.pool - rain.MAX_PER_PLAYER);
  });
});
