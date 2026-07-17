process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// creditUser is destructured at module load inside rounds.js/battleEngine.js, so it has
// to be replaced at require time; a later spy would not be seen by them
jest.mock("../../utils/economy", () => {
  const actual = jest.requireActual("../../utils/economy");
  return { ...actual, creditUser: jest.fn((...args) => actual.creditUser(...args)) };
});

const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Round = require("../../models/Round");
const Battle = require("../../models/Battle");
const Transaction = require("../../models/Transaction");
const { creditUser, TX } = require("../../utils/economy");
const { recoverStuckRounds } = require("../../utils/rounds");
const engine = require("../../games/battleEngine");
const { winPayout } = require("../../games/coinFlip");

beforeAll(setupDb);
afterEach(async () => {
  creditUser.mockClear();
  await clearDb();
});
afterAll(teardownDb);

const makeUser = (walletBalance) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
};

const balanceOf = async (u) => (await User.findById(u._id)).walletBalance;

const stakeRow = (user, roundId, amount, type) =>
  Transaction.create({
    userId: user._id, type, direction: "debit", amount, balanceAfter: 0,
    meta: { roundId: String(roundId) },
  });

// the process dying inside the refund loop, on the nth credit
const dieOnCredit = (n) => {
  const actual = jest.requireActual("../../utils/economy");
  let seen = 0;
  creditUser.mockImplementation(async (...args) => {
    seen += 1;
    if (seen === n) throw new Error("the process died mid-refund");
    return actual.creditUser(...args);
  });
};

const creditWorksAgain = () => {
  const actual = jest.requireActual("../../utils/economy");
  creditUser.mockImplementation((...args) => actual.creditUser(...args));
};

const recover = () => recoverStuckRounds(undefined, winPayout);

// a dead process leaves its lease behind. the next sweep only takes it over once the
// lease has gone stale, so that is what a later boot actually sees.
const expireLease = (Model, id) =>
  Model.updateOne({ _id: id }, { $set: { settlementStartedAt: new Date(Date.now() - 300000) } });

test("a restart inside the refund loop does not strand the stakers it had not reached", async () => {
  const a = await makeUser(900);
  const b = await makeUser(900);
  const c = await makeUser(900);
  const round = await Round.create({
    game: "crash", status: "betting",
    bets: [a, b, c].map((u) => ({ userId: u._id, amount: 100 })),
  });
  for (const u of [a, b, c]) await stakeRow(u, round._id, 100, TX.CRASH_BET);

  // the void gets one refund out and then the process dies
  dieOnCredit(2);
  await recover().catch(() => {});

  // a second boot must finish the job. the round is already marked voided, so this
  // only works if recovery revisits a void whose refunds never completed.
  creditWorksAgain();
  await expireLease(Round, round._id);
  await recover();

  expect(await balanceOf(a)).toBe(1000);
  expect(await balanceOf(b)).toBe(1000);
  expect(await balanceOf(c)).toBe(1000);
});

test("finishing an interrupted void does not refund the ones it already paid", async () => {
  const a = await makeUser(900);
  const b = await makeUser(900);
  const round = await Round.create({
    game: "crash", status: "betting",
    bets: [a, b].map((u) => ({ userId: u._id, amount: 100 })),
  });
  for (const u of [a, b]) await stakeRow(u, round._id, 100, TX.CRASH_BET);

  dieOnCredit(2);
  await recover().catch(() => {});
  creditWorksAgain();
  await expireLease(Round, round._id);
  await recover();
  await expireLease(Round, round._id);
  await recover(); // and again, for good measure

  expect(await balanceOf(a)).toBe(1000); // not 1100
  expect(await balanceOf(b)).toBe(1000);
  expect(await Transaction.countDocuments({ type: TX.CRASH_REFUND })).toBe(2);
});

test("a battle void interrupted mid-refund is finished on the next boot", async () => {
  const a = await makeUser(900);
  const b = await makeUser(900);
  const battle = await Battle.create({
    status: "in_progress",
    mode: "1v1",
    cases: [new mongoose.Types.ObjectId()],
    entryCost: 100,
    createdBy: a._id,
    players: [a, b].map((u, i) => ({ userId: u._id, username: u.username, team: i, slot: i })),
    rolls: [],
    currentRound: 0,
  });
  for (const u of [a, b]) {
    await Transaction.create({
      userId: u._id, type: TX.BATTLE_ENTRY, direction: "debit", amount: 100,
      balanceAfter: 0, meta: { battleId: battle._id },
    });
  }

  dieOnCredit(2);
  await engine.completeStuckBattles().catch(() => {});
  creditWorksAgain();
  await expireLease(Battle, battle._id);
  await engine.completeStuckBattles();

  expect(await balanceOf(a)).toBe(1000);
  expect(await balanceOf(b)).toBe(1000);
});
