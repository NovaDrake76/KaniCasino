process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const realtime = require("../../utils/realtime");
const { TX } = require("../../utils/economy");
const liveFeed = require("../../utils/liveFeed");

beforeAll(setupDb);
afterEach(async () => {
  liveFeed.reset();
  realtime.setIo(null);
  await clearDb();
});
afterAll(teardownDb);

const makeUser = (extra = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", ...extra });
};

const captureIo = () => {
  const emitted = [];
  realtime.setIo({ emit: (event, payload) => emitted.push({ event, payload }) });
  return emitted;
};

// the feed throttles per player, so a second entry needs the window to have passed
const past = (id) => liveFeed.reset();

describe("the live bet ticker", () => {
  test("broadcasts a settled bet and keeps it in memory", async () => {
    const user = await makeUser({ profilePicture: "pic", level: 12 });
    const emitted = captureIo();

    const entry = await liveFeed.publish({ game: "dice", user, bet: 100, payout: 250 });

    expect(entry).toMatchObject({
      game: "dice",
      username: user.username,
      bet: 100,
      payout: 250,
      multiplier: 2.5,
    });
    expect(emitted).toEqual([{ event: "liveBet", payload: entry }]);
    expect(liveFeed.recent()).toEqual([entry]);
  });

  test("writes nothing to the database", async () => {
    const user = await makeUser();
    const before = await Transaction.countDocuments({});

    await liveFeed.publish({ game: "dice", user, bet: 100, payout: 0 });

    expect(await Transaction.countDocuments({})).toBe(before);
  });

  test("a loss rides the feed as a zero multiplier", async () => {
    const user = await makeUser();
    const entry = await liveFeed.publish({ game: "mines", user, bet: 500, payout: 0 });
    expect(entry).toMatchObject({ bet: 500, payout: 0, multiplier: 0 });
  });

  test("resolves a bare userId, so a loss path needs no user document", async () => {
    const user = await makeUser({ level: 7 });
    const entry = await liveFeed.publish({ game: "hilo", userId: user._id, bet: 20, payout: 0 });
    expect(entry.username).toBe(user.username);
    expect(entry.level).toBe(7);
  });

  test("throttles one player, so a bot cannot own every row", async () => {
    const bot = await makeUser();
    const other = await makeUser();

    const first = await liveFeed.publish({ game: "dice", user: bot, bet: 10, payout: 0 });
    const second = await liveFeed.publish({ game: "dice", user: bot, bet: 10, payout: 0 });
    const third = await liveFeed.publish({ game: "dice", user: other, bet: 10, payout: 0 });

    expect(first).toBeTruthy();
    expect(second).toBeNull(); // inside the window
    expect(third).toBeTruthy(); // a different player is unaffected
    expect(liveFeed.recent()).toHaveLength(2);
  });

  test("keeps a banned account off every game page", async () => {
    const banned = await makeUser({ disabled: true });
    const emitted = captureIo();

    expect(await liveFeed.publish({ game: "dice", user: banned, bet: 10, payout: 0 })).toBeNull();
    expect(emitted).toHaveLength(0);
    expect(liveFeed.recent()).toHaveLength(0);
  });

  test("a free case open is a gift, not a bet, and never reaches the feed", async () => {
    const user = await makeUser();
    expect(await liveFeed.publish({ game: "case", user, bet: 0, payout: 900 })).toBeNull();
  });

  test("the buffer is capped, newest first", async () => {
    for (let i = 0; i < liveFeed.KEEP + 10; i++) {
      const user = await makeUser();
      await liveFeed.publish({ game: "dice", user, bet: i + 1, payout: 0 });
    }
    const rows = liveFeed.recent();
    expect(rows).toHaveLength(liveFeed.KEEP);
    expect(rows[0].bet).toBe(liveFeed.KEEP + 10);
  });

  test("never throws, so it cannot fail a bet that was already paid", async () => {
    realtime.setIo({
      emit: () => {
        throw new Error("socket exploded");
      },
    });
    const user = await makeUser();
    await expect(liveFeed.publish({ game: "dice", user, bet: 10, payout: 0 })).resolves.toBeNull();
  });
});

describe("the boot seed", () => {
  const winRow = (user, type, at, meta) =>
    Transaction.create({
      userId: user._id, type, direction: "credit", amount: meta.payout || 0,
      balanceAfter: 0, meta, createdAt: at,
    });

  test("rebuilds recent rows from win rows already in the ledger", async () => {
    const user = await makeUser();
    await winRow(user, TX.DICE_WIN, new Date(Date.now() - 60000), { betAmount: 200, payout: 400 });

    expect(await liveFeed.seed()).toBe(1);
    expect(liveFeed.recent()[0]).toMatchObject({
      game: "dice", bet: 200, payout: 400, multiplier: 2,
    });
  });

  test("ignores rows older than the window rather than passing them off as live", async () => {
    const user = await makeUser();
    const old = new Date(Date.now() - liveFeed.SEED_WINDOW_MS - 60000);
    await winRow(user, TX.DICE_WIN, old, { betAmount: 200, payout: 400 });

    expect(await liveFeed.seed()).toBe(0);
    expect(liveFeed.recent()).toHaveLength(0);
  });

  test("leaves a disabled account out of the seed too", async () => {
    const banned = await makeUser({ disabled: true });
    await winRow(banned, TX.DICE_WIN, new Date(), { betAmount: 200, payout: 400 });

    expect(await liveFeed.seed()).toBe(0);
  });

  test("writes nothing while seeding", async () => {
    const user = await makeUser();
    await winRow(user, TX.PLINKO_WIN, new Date(), { betAmount: 50, payout: 75 });
    const before = await Transaction.countDocuments({});

    await liveFeed.seed();

    expect(await Transaction.countDocuments({})).toBe(before);
  });
});
