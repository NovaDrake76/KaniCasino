process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const mongoose = require("mongoose");
const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Case = require("../../models/Case");
const Item = require("../../models/Item");
const Transaction = require("../../models/Transaction");
const LedgerDay = require("../../models/LedgerDay");
const LedgerFold = require("../../models/LedgerFold");
const Leaderboard = require("../../models/Leaderboard");
const MissionState = require("../../models/MissionState");
const memo = require("../../utils/memo");
const ledgerDays = require("../../utils/ledgerDays");
const missions = require("../../utils/missions");
const roadmap = require("../../utils/roadmap");
const referrals = require("../../utils/referrals");
const adminStats = require("../../utils/adminStats");
const shop = require("../../utils/shop");
const { accountBalance, TX } = require("../../utils/economy");
const { HOUSE, MINT } = require("../../utils/accounts");

jest.setTimeout(60000);

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(async () => {
  delete process.env.LEDGER_PRUNE;
  await clearDb();
});
afterAll(teardownDb);

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const T0 = () => Math.floor(Date.now() / DAY) * DAY;

// an _id minted at `at`, the way every app write mints it with the row's createdAt
let minted = 0;
const idAt = (at) =>
  new mongoose.Types.ObjectId(Math.floor(at / 1000).toString(16).padStart(8, "0") + (++minted).toString(16).padStart(16, "0"));

const row = (userId, type, direction, amount, at, meta = {}, counterparty = HOUSE) =>
  Transaction.create({
    _id: idAt(at),
    userId,
    type,
    direction,
    amount,
    balanceAfter: 0,
    counterparty,
    meta,
    createdAt: new Date(at),
  });

const makeUser = (extra = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance: 1000, ...extra });
};

async function makeCase() {
  const s = uniqueSuffix();
  const item = await Item.create({ name: `i-${s}`, image: "i.png", rarity: "3" });
  return Case.create({ title: `c-${s}`, image: "c.png", price: 50, items: [item._id] });
}

const GOALS = ["fullPots", "bonusSpent", "itemsSold", "gamesTried", "marketTrades", "casesOpened", "staked", "daysPlayed", "bigWin", "rainsCaught"];

// twenty days of play: rows past both retentions, rows past only the short one, rows inside both,
// and a roadmap chapter that opened at noon on a day that gets folded and then pruned
async function seed() {
  const t0 = T0();
  const bob = await makeUser();
  const alice = await makeUser({ referredBy: bob._id, level: 3 });
  const carol = await makeUser();
  const [caseA, caseB] = [await makeCase(), await makeCase()];
  const at = (days, hours) => t0 - days * DAY + hours * HOUR;
  const opened = at(5, 12);

  await row(alice._id, TX.CASE_OPEN, "debit", 100, at(20, 2), { caseId: caseA._id, caseTitle: caseA.title, quantity: 2 });
  await row(alice._id, TX.BLACKJACK_BET, "debit", 50, at(20, 3), { handId: "h1" });
  await row(alice._id, TX.BLACKJACK_BET, "debit", 50, at(20, 3), { handId: "h1", double: true });
  await row(alice._id, TX.BLACKJACK_WIN, "credit", 150, at(20, 3), { handId: "h1" });
  await row(alice._id, TX.BONUS, "credit", 200, at(20, 4), { fill: 1 }, MINT);
  await row(alice._id, TX.ITEM_SELL, "credit", 30, at(20, 5), { count: 1, source: "quicksell" });
  await row(alice._id, TX.MISSION_REWARD, "credit", 500, at(20, 6), { missionKey: "m1" }, MINT);
  await row(alice._id, TX.PLINKO_BET, "debit", 10, at(20, 7));
  await row(alice._id, TX.PLINKO_WIN, "credit", 25, at(20, 7));
  await row(carol._id, TX.PLINKO_BET, "debit", 100, at(20, 8));
  await row(carol._id, TX.PLINKO_WIN, "credit", 60000, at(20, 8), { betAmount: 100 });

  await row(alice._id, TX.DICE_BET, "debit", 20, at(10, 1), { credit: 5 });
  await row(alice._id, TX.DICE_WIN, "credit", 39, at(10, 1));
  await row(bob._id, TX.CRASH_BET, "debit", 40, at(10, 2));
  await row(bob._id, TX.CRASH_CASHOUT, "credit", 80, at(10, 2));
  await row(alice._id, TX.MARKET_SALE, "credit", 300, at(10, 3), { itemName: "x" }, null);
  await row(carol._id, TX.SLOT_BET, "debit", 5, at(10, 4));
  await row(carol._id, TX.SLOT_WIN, "credit", 12, at(10, 4));

  await row(alice._id, TX.PLINKO_BET, "debit", 10, at(5, 8));
  await row(alice._id, TX.BONUS, "credit", 90, at(5, 9), { fill: 1 }, MINT);
  await row(alice._id, TX.PLINKO_BET, "debit", 15, at(5, 14));
  await row(alice._id, TX.PLINKO_WIN, "credit", 40, at(5, 14));
  await row(alice._id, TX.CASE_OPEN, "debit", 50, at(5, 15), { caseId: caseB._id, caseTitle: caseB.title, quantity: 1 });
  await row(alice._id, TX.BONUS, "credit", 100, at(5, 16), { fill: 1 }, MINT);

  await row(alice._id, TX.PLINKO_BET, "debit", 20, at(2, 3));
  await row(alice._id, TX.PLINKO_WIN, "credit", 10, at(2, 3));
  await row(bob._id, TX.COINFLIP_BET, "debit", 30, at(2, 4));
  await row(bob._id, TX.COINFLIP_WIN, "credit", 57, at(2, 4));

  await row(alice._id, TX.DICE_BET, "debit", 7, Date.now() - 1000);
  await row(carol._id, TX.CASE_OPEN, "debit", 150, Date.now() - 1000, { caseId: caseA._id, caseTitle: caseA.title, quantity: 3 });

  await MissionState.create({ userId: alice._id, roadmap: { chapter: 7, openedAt: new Date(opened) } });
  return { alice, bob, carol, opened };
}

const byType = (rows) => [...rows].sort((a, b) => String(a.type).localeCompare(String(b.type)));

// every reader of the whole ledger, as a player or the backoffice would see it
async function readAll({ alice, bob, carol, opened }) {
  memo.forget("cases:");
  const state = await MissionState.findOne({ userId: alice._id }).lean();
  const head = state.roadmap.head || null;
  const context = async (id) => {
    const { claimed, visited, announced, ...rest } = await missions.buildContext(id, { includeCollections: false });
    return rest;
  };
  const games = await adminStats.gameStats();
  const { recent, ...detail } = await adminStats.playerDetail(String(alice._id));
  return {
    missions: [await context(alice._id), await context(bob._id), await context(carol._id)],
    roadmap: await roadmap.ledgerSince(alice._id, new Date(opened), GOALS, head),
    chapter: await roadmap.viewFor(await User.findById(alice._id)),
    referrals: (await referrals.getDashboard(bob._id)).referrals.map(({ wagered, commission, active }) => ({ wagered, commission, active })),
    mostOpened: (await request(app).get("/cases/most-opened?limit=5")).body.map((c) => [c.title, c.opens]),
    balances: [await accountBalance(HOUSE), await accountBalance(MINT), await accountBalance(alice._id), await accountBalance(carol._id)],
    overview: await adminStats.overview(),
    games: { ...games, houseLines: byType(games.houseLines), issuance: byType(games.issuance) },
    cases: await adminStats.caseStats(),
    series: await adminStats.timeseries(),
    detail,
    users: (await adminStats.userStats({})).users.map(({ id, wagered, lastActive }) => ({ id, wagered, lastActive })),
  };
}

describe("folding the ledger into daily totals", () => {
  test("every whole-ledger reader answers the same before the fold, after it, and after the prune", async () => {
    const world = await seed();
    const before = await readAll(world);
    expect(before.roadmap.staked).toBe(92);
    expect(before.roadmap.fullPots).toBe(1);

    expect(await ledgerDays.foldClosedDays({ now: T0() + 20 * 60 * 1000 })).toBe(20);
    const fold = await LedgerFold.findById("fold").lean();
    expect(fold.through.getTime()).toBe(T0());
    expect(await readAll(world)).toEqual(before);

    process.env.LEDGER_PRUNE = "1";
    expect(await ledgerDays.prune()).toBeGreaterThan(0);
    expect(await readAll(world)).toEqual(before);
  });

  test("the prune keeps each retention, big payouts, and the rows nothing folds away", async () => {
    const world = await seed();
    await ledgerDays.foldClosedDays({ now: T0() + 20 * 60 * 1000 });
    process.env.LEDGER_PRUNE = "1";
    await ledgerDays.prune();

    const left = await Transaction.find({}, { type: 1, amount: 1, createdAt: 1 }).lean();
    const age = (r) => (T0() - r.createdAt.getTime()) / DAY;
    // plinko, dice and slots past three days are gone, except the payout of 50,000 or more
    expect(left.filter((r) => ledgerDays.SHORT_TYPES.includes(r.type) && age(r) > 3).map((r) => r.amount)).toEqual([60000]);
    // the other games, bonuses and sales go after fourteen days
    expect(left.filter((r) => ledgerDays.LONG_TYPES.includes(r.type) && age(r) > 14)).toEqual([]);
    expect(left.filter((r) => ledgerDays.LONG_TYPES.includes(r.type) && age(r) < 14).length).toBe(8);
    // rows outside both lists stay for good
    expect(left.filter((r) => r.type === TX.MISSION_REWARD || r.type === TX.MARKET_SALE).length).toBe(2);
    // the short rows inside three days are untouched
    expect(left.filter((r) => ledgerDays.SHORT_TYPES.includes(r.type) && age(r) <= 3).length).toBe(3);
    expect(world.alice).toBeTruthy();
  });

  test("folding twice writes the same totals", async () => {
    await seed();
    await ledgerDays.foldClosedDays({ now: T0() + 20 * 60 * 1000 });
    const first = await LedgerDay.find({}).sort({ _id: 1 }).lean();
    await LedgerFold.updateOne({ _id: "fold" }, { $set: { through: null } });
    await ledgerDays.foldClosedDays({ now: T0() + 20 * 60 * 1000 });
    expect(await LedgerDay.find({}).sort({ _id: 1 }).lean()).toEqual(first);
  });

  test("a day folds only once its grace has passed", async () => {
    const { alice } = await seed();
    await row(alice._id, TX.PLINKO_BET, "debit", 3, T0() - HOUR);
    await ledgerDays.foldClosedDays({ now: T0() + 5 * 60 * 1000 });
    expect((await LedgerFold.findById("fold").lean()).through.getTime()).toBe(T0() - DAY);
    await ledgerDays.foldClosedDays({ now: T0() + 16 * 60 * 1000 });
    expect((await LedgerFold.findById("fold").lean()).through.getTime()).toBe(T0());
  });

  test("the prune never passes the watermark or a board still owed", async () => {
    await seed();
    process.env.LEDGER_PRUNE = "1";
    // folded only up to nine days ago, so the short rows of five days ago must stay
    await ledgerDays.foldClosedDays({ now: T0() - 9 * DAY + HOUR });
    await ledgerDays.prune();
    const short = async (days) =>
      Transaction.countDocuments({
        type: { $in: ledgerDays.SHORT_TYPES },
        createdAt: { $gte: new Date(T0() - days * DAY), $lt: new Date(T0() - (days - 1) * DAY) },
      });
    expect(await short(20)).toBe(1);
    expect(await short(10)).toBe(0);
    expect(await short(5)).toBe(3);

    await ledgerDays.foldClosedDays({ now: T0() + 20 * 60 * 1000 });
    await Leaderboard.create({ startsAt: new Date(T0() - 6 * DAY), endsAt: new Date(T0() - 5 * DAY), status: "running" });
    await ledgerDays.prune();
    expect(await short(5)).toBe(3);
  });

  test("a day the prune has reached is never folded again", async () => {
    await seed();
    await ledgerDays.foldClosedDays({ now: T0() + 20 * 60 * 1000 });
    process.env.LEDGER_PRUNE = "1";
    await ledgerDays.prune();
    const totals = await LedgerDay.countDocuments({});
    await LedgerFold.updateOne({ _id: "fold" }, { $set: { through: null } });
    await expect(ledgerDays.foldClosedDays({ now: T0() + 20 * 60 * 1000 })).rejects.toThrow(/refusing to refold/);
    expect(await LedgerDay.countDocuments({})).toBe(totals);
  });

  test("nothing is deleted while LEDGER_PRUNE is off", async () => {
    await seed();
    const rows = await Transaction.countDocuments({});
    await ledgerDays.foldClosedDays({ now: T0() + 20 * 60 * 1000 });
    expect(await ledgerDays.prune()).toBe(0);
    expect(await Transaction.countDocuments({})).toBe(rows);
  });

  test("a quick sell that was pruned still counts as shop evidence", async () => {
    const { alice } = await seed();
    await ledgerDays.foldClosedDays({ now: T0() + 20 * 60 * 1000 });
    process.env.LEDGER_PRUNE = "1";
    await ledgerDays.prune();
    expect(await Transaction.exists({ userId: alice._id, type: TX.ITEM_SELL })).toBeNull();
    expect(await shop.unlocksOf(await User.findById(alice._id))).toContain("collectionBook");
  });

  test("the balance history says how long game rows stay, once rows are deleted", async () => {
    const user = await makeUser();
    const get = () => request(app).get("/users/transactions").set("Authorization", `Bearer ${tokenFor(user)}`);
    expect((await get()).body.retention).toBeNull();
    process.env.LEDGER_PRUNE = "1";
    expect((await get()).body.retention).toEqual({ shortDays: 3, longDays: 14 });
  });
});
