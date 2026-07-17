process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Round = require("../../models/Round");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");
const { recoverStuckRounds } = require("../../utils/rounds");
const { winPayout } = require("../../games/coinFlip");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (walletBalance) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
};

const balanceOf = async (user) => (await User.findById(user._id)).walletBalance;

// the ledger row chargeUser writes when a stake is taken
const stakeRow = (user, round, amount, type) =>
  Transaction.create({
    userId: user._id, type, direction: "debit", amount, balanceAfter: 0,
    meta: { roundId: String(round._id) },
  });

const paidRow = (user, round, amount, type) =>
  Transaction.create({
    userId: user._id, type, direction: "credit", amount, balanceAfter: 0,
    meta: { roundId: String(round._id) },
  });

// the boot recovery: at restart every betting/running round is genuinely orphaned
const recover = () => recoverStuckRounds(undefined, winPayout, { boot: true });
// the periodic sweep: the live loops are still playing, so it must skip their rounds
const sweep = () => recoverStuckRounds(undefined, winPayout, { boot: false });

describe("rounds a restart left in flight", () => {
  test("a crash round caught during betting gives every stake back", async () => {
    const a = await makeUser(900);
    const b = await makeUser(800);
    const round = await Round.create({
      game: "crash", status: "betting",
      bets: [{ userId: a._id, amount: 100 }, { userId: b._id, amount: 200 }],
    });
    await stakeRow(a, round, 100, TX.CRASH_BET);
    await stakeRow(b, round, 200, TX.CRASH_BET);

    expect(await recover()).toEqual({ voided: 1, settled: 0 });

    expect((await Round.findById(round._id)).status).toBe("voided");
    expect(await balanceOf(a)).toBe(1000);
    expect(await balanceOf(b)).toBe(1000);
  });

  test("a crash round caught mid-flight refunds who never cashed out, and only them", async () => {
    const cashed = await makeUser(1150); // staked 100, took 250 out at 2.5x
    const riding = await makeUser(900); // staked 100, never got the chance
    const round = await Round.create({
      game: "crash", status: "running", outcome: { crashPoint: 4 },
      bets: [
        { userId: cashed._id, amount: 100, payout: 250, multiplier: 2.5 },
        { userId: riding._id, amount: 100, payout: 0 },
      ],
    });
    await stakeRow(cashed, round, 100, TX.CRASH_BET);
    await stakeRow(riding, round, 100, TX.CRASH_BET);
    await paidRow(cashed, round, 250, TX.CRASH_CASHOUT);

    await recover();

    expect(await balanceOf(cashed)).toBe(1150); // already has their money
    expect(await balanceOf(riding)).toBe(1000); // a round that did not finish cannot lose
  });

  test("a coin flip caught before the toss gives every stake back", async () => {
    const a = await makeUser(900);
    const round = await Round.create({
      game: "coinflip", status: "betting",
      bets: [{ userId: a._id, amount: 100, side: "heads" }],
    });
    await stakeRow(a, round, 100, TX.COINFLIP_BET);

    expect(await recover()).toEqual({ voided: 1, settled: 0 });
    expect(await balanceOf(a)).toBe(1000);
  });

  test("a coin flip that already landed pays the winners it never reached", async () => {
    const winner = await makeUser(900);
    const loser = await makeUser(900);
    const round = await Round.create({
      game: "coinflip", status: "running", outcome: { result: 0, winningSide: "heads" },
      bets: [
        { userId: winner._id, amount: 100, side: "heads" },
        { userId: loser._id, amount: 100, side: "tails" },
      ],
    });
    await stakeRow(winner, round, 100, TX.COINFLIP_BET);
    await stakeRow(loser, round, 100, TX.COINFLIP_BET);

    expect(await recover()).toEqual({ voided: 0, settled: 1 });

    expect((await Round.findById(round._id)).status).toBe("settled");
    expect(await balanceOf(winner)).toBe(900 + winPayout(100));
    // the coin landed, so this one lost fairly and is not handed their stake back
    expect(await balanceOf(loser)).toBe(900);
  });

  test("a winner the interruption already paid is not paid twice", async () => {
    const winner = await makeUser(900 + winPayout(100));
    const round = await Round.create({
      game: "coinflip", status: "running", outcome: { result: 0, winningSide: "heads" },
      bets: [{ userId: winner._id, amount: 100, side: "heads" }],
    });
    await stakeRow(winner, round, 100, TX.COINFLIP_BET);
    await paidRow(winner, round, winPayout(100), TX.COINFLIP_WIN);

    await recover();

    expect(await balanceOf(winner)).toBe(900 + winPayout(100));
  });

  test("recovering twice does not pay twice", async () => {
    const a = await makeUser(900);
    const round = await Round.create({
      game: "crash", status: "betting",
      bets: [{ userId: a._id, amount: 100 }],
    });
    await stakeRow(a, round, 100, TX.CRASH_BET);

    await recover();
    expect(await recover()).toEqual({ voided: 0, settled: 0 });
    expect(await balanceOf(a)).toBe(1000);
  });

  test("a round that finished normally is left alone", async () => {
    const a = await makeUser(900);
    const round = await Round.create({
      game: "crash", status: "settled", outcome: { crashPoint: 1.5 },
      bets: [{ userId: a._id, amount: 100, payout: 0 }],
    });
    await stakeRow(a, round, 100, TX.CRASH_BET);

    expect(await recover()).toEqual({ voided: 0, settled: 0 });
    expect(await balanceOf(a)).toBe(900); // they lost the round, fair and square
  });

  test("a stake taken with no round to account against is still given back", async () => {
    // the charge lands, then the process dies before the bet reaches the round doc
    const a = await makeUser(900);
    const round = await Round.create({ game: "crash", status: "betting", bets: [] });
    await stakeRow(a, round, 100, TX.CRASH_BET);

    await recover();

    // the ledger knows, which is the whole reason the refund reads from it
    expect(await balanceOf(a)).toBe(1000);
  });
});

describe("the periodic sweep leaves the live loops' rounds alone", () => {
  test("a live betting round is not voided out from under the loop", async () => {
    const a = await makeUser(900);
    const round = await Round.create({
      game: "crash", status: "betting", bets: [{ userId: a._id, amount: 100 }],
    });
    await stakeRow(a, round, 100, TX.CRASH_BET);

    expect(await sweep()).toEqual({ voided: 0, settled: 0 });
    expect((await Round.findById(round._id)).status).toBe("betting");
    expect(await balanceOf(a)).toBe(900); // stake not refunded mid-round
  });

  test("a live running coin flip is not settled early", async () => {
    const winner = await makeUser(900);
    const round = await Round.create({
      game: "coinflip", status: "running", outcome: { result: 0, winningSide: "heads" },
      bets: [{ userId: winner._id, amount: 100, side: "heads" }],
    });
    await stakeRow(winner, round, 100, TX.COINFLIP_BET);

    expect(await sweep()).toEqual({ voided: 0, settled: 0 });
    expect(await balanceOf(winner)).toBe(900); // the live loop pays it, not the sweep
  });

  test("but it still resumes a give-back loop that died holding a stale lease", async () => {
    const a = await makeUser(900);
    const round = await Round.create({
      game: "crash", status: "voided",
      settlementStartedAt: new Date(Date.now() - 120000), // older than the 60s lease
      bets: [{ userId: a._id, amount: 100 }],
    });
    await stakeRow(a, round, 100, TX.CRASH_BET);

    expect(await sweep()).toEqual({ voided: 1, settled: 0 });
    expect(await balanceOf(a)).toBe(1000);
    expect((await Round.findById(round._id)).settlementDone).toBe(true);
  });
});
