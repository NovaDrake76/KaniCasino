process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Leaderboard = require("../../models/Leaderboard");
const Transaction = require("../../models/Transaction");
const Notification = require("../../models/Notification");
const { TX } = require("../../utils/economy");
const leaderboard = require("../../utils/leaderboard");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (walletBalance = 1000, extra = {}) => {
  const s = uniqueSuffix();
  return User.create({
    username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance, ...extra,
  });
};

// a stake as chargeUser writes it: the ledger row is the only thing the board reads
const wager = (user, type, amount, at) =>
  Transaction.create({
    userId: user._id, type, direction: "debit", amount, balanceAfter: 0,
    meta: {}, createdAt: at || new Date(),
  });

const balanceOf = async (user) => (await User.findById(user._id)).walletBalance;
const midWindow = () => {
  const { startsAt } = leaderboard.windowFor();
  return new Date(startsAt.getTime() + 3600000);
};

describe("the daily window", () => {
  test("is exactly 24 hours and contains now", () => {
    const now = new Date();
    const { startsAt, endsAt } = leaderboard.windowFor(now);
    expect(endsAt - startsAt).toBe(86400000);
    expect(startsAt <= now && now < endsAt).toBe(true);
  });

  test("two instants in the same day land on the same window", () => {
    const a = leaderboard.windowFor(new Date("2026-08-29T04:00:00Z"));
    const b = leaderboard.windowFor(new Date("2026-08-30T02:59:59Z"));
    expect(a.startsAt.toISOString()).toBe(b.startsAt.toISOString());
  });

  test("the turnover opens a new window", () => {
    const before = leaderboard.windowFor(new Date("2026-08-30T02:59:59Z"));
    const after = leaderboard.windowFor(new Date("2026-08-30T03:00:00Z"));
    expect(after.startsAt.getTime()).toBe(before.endsAt.getTime());
  });
});

describe("the board", () => {
  test("ranks by points, not by amount wagered", async () => {
    const grinder = await makeUser();
    const opener = await makeUser();
    const { startsAt, endsAt } = leaderboard.windowFor();
    // the dice player wagers more but the case player scores more: 100k x 0.4 vs 50k x 1.5
    await wager(grinder, TX.DICE_BET, 100000, midWindow());
    await wager(opener, TX.CASE_OPEN, 50000, midWindow());

    const rows = await leaderboard.standings(startsAt, endsAt);
    expect(rows).toHaveLength(2);
    expect(String(rows[0]._id)).toBe(String(opener._id));
    expect(rows[0].points).toBe(75000);
    expect(rows[1].points).toBe(40000);
  });

  test("sums every game a player touched", async () => {
    const user = await makeUser();
    const { startsAt, endsAt } = leaderboard.windowFor();
    await wager(user, TX.CRASH_BET, 1000, midWindow());
    await wager(user, TX.COINFLIP_BET, 1000, midWindow());
    await wager(user, TX.BLACKJACK_BET, 1000, midWindow());

    const rows = await leaderboard.standings(startsAt, endsAt);
    expect(rows[0].points).toBe(1300 + 1000 + 400);
    expect(rows[0].bets).toBe(3);
  });

  test("ignores anything that is not a wager", async () => {
    const user = await makeUser();
    const { startsAt, endsAt } = leaderboard.windowFor();
    await wager(user, TX.CRASH_BET, 1000, midWindow());
    await Transaction.create({
      userId: user._id, type: TX.BONUS, direction: "credit", amount: 500000,
      balanceAfter: 0, meta: {}, createdAt: midWindow(),
    });

    const rows = await leaderboard.standings(startsAt, endsAt);
    expect(rows[0].points).toBe(1300);
  });

  test("ignores a bet from a previous race", async () => {
    const user = await makeUser();
    const { startsAt, endsAt } = leaderboard.windowFor();
    await wager(user, TX.CRASH_BET, 1000, new Date(startsAt.getTime() - 60000));

    expect(await leaderboard.standings(startsAt, endsAt)).toHaveLength(0);
  });

  test("leaves a disabled account off, the way the public board does", async () => {
    // the old weekly cron read User.find({}) and could award a prize to a banned account
    const banned = await makeUser(1000, { disabled: true });
    const ordinary = await makeUser();
    const { startsAt, endsAt } = leaderboard.windowFor();
    await wager(banned, TX.CASE_OPEN, 100000, midWindow());
    await wager(ordinary, TX.CASE_OPEN, 1000, midWindow());

    const rows = await leaderboard.standings(startsAt, endsAt);
    expect(rows).toHaveLength(1);
    expect(String(rows[0]._id)).toBe(String(ordinary._id));
  });
});

describe("a player's own standing", () => {
  test("reports their points and where they sit", async () => {
    const leader = await makeUser();
    const me = await makeUser();
    const { startsAt, endsAt } = leaderboard.windowFor();
    await wager(leader, TX.CASE_OPEN, 10000, midWindow());
    await wager(me, TX.CASE_OPEN, 1000, midWindow());

    expect(await leaderboard.standingFor(me._id, startsAt, endsAt)).toEqual({
      points: 1500, bets: 1, rank: 2,
    });
  });

  test("a player who has not bet today has no rank", async () => {
    const me = await makeUser();
    const { startsAt, endsAt } = leaderboard.windowFor();
    expect(await leaderboard.standingFor(me._id, startsAt, endsAt)).toEqual({
      points: 0, bets: 0, rank: null,
    });
  });
});

describe("settlement", () => {
  const seedRace = async () => {
    const { startsAt, endsAt } = leaderboard.windowFor(new Date(Date.now() - 86400000));
    return Leaderboard.create({ startsAt, endsAt, status: "running" });
  };
  const inRace = (r) => new Date(r.startsAt.getTime() + 3600000);

  test("pays every paid place, biggest first, and nobody below it", async () => {
    const r = await seedRace();
    const players = [];
    for (let i = 0; i < 12; i++) {
      const u = await makeUser(0);
      // descending stakes, so the finishing order is known
      await wager(u, TX.COINFLIP_BET, (12 - i) * 1000, inRace(r));
      players.push(u);
    }

    await leaderboard.settleBoard(r);

    for (let i = 0; i < leaderboard.PAID_PLACES; i++) {
      expect(await balanceOf(players[i])).toBe(leaderboard.PRIZES[i]);
    }
    // 11th and 12th played and are paid nothing
    expect(await balanceOf(players[10])).toBe(0);
    expect(await balanceOf(players[11])).toBe(0);
  });

  test("writes a ledger row against the house for every prize", async () => {
    const r = await seedRace();
    const u = await makeUser(0);
    await wager(u, TX.CASE_OPEN, 1000, inRace(r));

    await leaderboard.settleBoard(r);

    const row = await Transaction.findOne({ userId: u._id, type: TX.LEADERBOARD_PRIZE });
    expect(row.amount).toBe(leaderboard.PRIZES[0]);
    expect(row.meta.rank).toBe(1);
    expect(row.meta.leaderboardId).toBe(String(r._id));
    expect(String(row.counterparty)).toBe("000000000000000000000000");
  });

  test("settling twice does not pay twice", async () => {
    const r = await seedRace();
    const u = await makeUser(0);
    await wager(u, TX.CASE_OPEN, 1000, inRace(r));

    await leaderboard.settleBoard(r);
    // the lease has to be stale for a second run to claim it at all
    await Leaderboard.updateOne({ _id: r._id }, { $set: { settlementStartedAt: new Date(0), settlementDone: false } });
    await leaderboard.settleBoard(await Leaderboard.findById(r._id));

    expect(await balanceOf(u)).toBe(leaderboard.PRIZES[0]);
    expect(await Transaction.countDocuments({ userId: u._id, type: TX.LEADERBOARD_PRIZE })).toBe(1);
    expect(await Notification.countDocuments({ receiverId: u._id, type: "message" })).toBe(1);
  });

  test("a race nobody played is closed without paying anyone", async () => {
    const r = await seedRace();
    await leaderboard.settleBoard(r);

    const done = await Leaderboard.findById(r._id);
    expect(done.status).toBe("settled");
    expect(done.settlementDone).toBe(true);
    expect(done.standings).toHaveLength(0);
    expect(await Transaction.countDocuments({ type: TX.LEADERBOARD_PRIZE })).toBe(0);
  });

  test("the standings snapshot is kept, so a later redraw cannot reorder a paid race", async () => {
    const r = await seedRace();
    const first = await makeUser(0);
    const second = await makeUser(0);
    await wager(first, TX.CASE_OPEN, 2000, inRace(r));
    await wager(second, TX.CASE_OPEN, 1000, inRace(r));

    await leaderboard.settleBoard(r);

    const done = await Leaderboard.findById(r._id);
    expect(done.standings.map((s) => s.rank)).toEqual([1, 2]);
    expect(String(done.standings[0].userId)).toBe(String(first._id));
    expect(done.standings[0].prize).toBe(leaderboard.PRIZES[0]);
    expect(done.standings.every((s) => s.paidAt)).toBe(true);
  });

  test("the winner is told what they won", async () => {
    const r = await seedRace();
    const u = await makeUser(0);
    await wager(u, TX.CASE_OPEN, 1000, inRace(r));

    await leaderboard.settleBoard(r);

    const note = await Notification.findOne({ receiverId: u._id, type: "message" });
    expect(note.title).toBe("Daily Leaderboard — 1st place");
    expect(note.content).toContain("K₽10,000");
    expect(note.content).toContain("1st");
  });
});

describe("the sweep", () => {
  test("settles a race whose clock ran out and opens today's", async () => {
    const { startsAt, endsAt } = leaderboard.windowFor(new Date(Date.now() - 86400000));
    const yesterday = await Leaderboard.create({ startsAt, endsAt, status: "running" });
    const u = await makeUser(0);
    await wager(u, TX.CASE_OPEN, 1000, new Date(startsAt.getTime() + 3600000));

    expect(await leaderboard.sweepBoards()).toBe(1);

    expect((await Leaderboard.findById(yesterday._id)).settlementDone).toBe(true);
    expect(await balanceOf(u)).toBe(leaderboard.PRIZES[0]);
    // and today's board now exists
    const today = leaderboard.windowFor();
    expect(await Leaderboard.findOne({ startsAt: today.startsAt })).toBeTruthy();
  });

  test("leaves the running race alone", async () => {
    const current = await leaderboard.ensureToday();
    const u = await makeUser(0);
    await wager(u, TX.CASE_OPEN, 1000, midWindow());

    expect(await leaderboard.sweepBoards()).toBe(0);

    expect((await Leaderboard.findById(current._id)).status).toBe("running");
    expect(await balanceOf(u)).toBe(0);
  });

  test("ensureToday is safe to call repeatedly", async () => {
    const a = await leaderboard.ensureToday();
    const b = await leaderboard.ensureToday();
    expect(String(a._id)).toBe(String(b._id));
    expect(await Leaderboard.countDocuments({})).toBe(1);
  });
});

describe("the empty seats", () => {
  test("fills the board out to the paid places with players who have not bet", async () => {
    const better = await makeUser(1000, { level: 5 });
    for (let i = 0; i < 4; i++) await makeUser(1000, { level: 40 - i });
    const { startsAt, endsAt } = leaderboard.windowFor();
    await wager(better, TX.CASE_OPEN, 1000, midWindow());

    const rows = await leaderboard.padStandings(
      await leaderboard.standings(startsAt, endsAt, leaderboard.PAID_PLACES),
      leaderboard.PAID_PLACES
    );

    // one real standing, then the rest of the field
    expect(rows).toHaveLength(5);
    expect(String(rows[0]._id)).toBe(String(better._id));
    expect(rows[0].placeholder).toBeUndefined();
    expect(rows.slice(1).every((row) => row.placeholder === true)).toBe(true);
    expect(rows.slice(1).every((row) => row.points === 0)).toBe(true);
    // the biggest accounts take the empty seats, so they read as names
    expect(rows.slice(1).map((row) => row.user.level)).toEqual([40, 39, 38, 37]);
  });

  test("never seats the same player twice", async () => {
    const better = await makeUser(1000, { level: 60 });
    await makeUser(1000, { level: 50 });
    const { startsAt, endsAt } = leaderboard.windowFor();
    await wager(better, TX.CASE_OPEN, 1000, midWindow());

    const rows = await leaderboard.padStandings(
      await leaderboard.standings(startsAt, endsAt, leaderboard.PAID_PLACES),
      leaderboard.PAID_PLACES
    );

    const ids = rows.map((row) => String(row._id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("leaves a disabled account out of the empty seats too", async () => {
    await makeUser(1000, { level: 90, disabled: true });
    await makeUser(1000, { level: 10 });

    const { startsAt, endsAt } = leaderboard.windowFor();
    const rows = await leaderboard.padStandings(
      await leaderboard.standings(startsAt, endsAt, leaderboard.PAID_PLACES),
      leaderboard.PAID_PLACES
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].user.level).toBe(10);
  });

  test("a full board is left alone", async () => {
    const { startsAt, endsAt } = leaderboard.windowFor();
    for (let i = 0; i < leaderboard.PAID_PLACES; i++) {
      const u = await makeUser(1000);
      await wager(u, TX.CASE_OPEN, (leaderboard.PAID_PLACES - i) * 100, midWindow());
    }
    await makeUser(1000, { level: 99 });

    const rows = await leaderboard.padStandings(
      await leaderboard.standings(startsAt, endsAt, leaderboard.PAID_PLACES),
      leaderboard.PAID_PLACES
    );

    expect(rows).toHaveLength(leaderboard.PAID_PLACES);
    expect(rows.some((row) => row.placeholder)).toBe(false);
  });

  test("a seat on nought is never paid at settlement", async () => {
    // padding is a display concern: the settle path reads standings, which drops zeroes
    const { startsAt, endsAt } = leaderboard.windowFor(new Date(Date.now() - 86400000));
    const board = await Leaderboard.create({ startsAt, endsAt, status: "running" });
    const better = await makeUser(0);
    await makeUser(0, { level: 99 });
    await wager(better, TX.CASE_OPEN, 1000, new Date(startsAt.getTime() + 3600000));

    await leaderboard.settleBoard(board);

    const done = await Leaderboard.findById(board._id);
    expect(done.standings).toHaveLength(1);
    expect(await Transaction.countDocuments({ type: TX.LEADERBOARD_PRIZE })).toBe(1);
  });
});
