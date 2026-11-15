process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.MISSIONS_LAUNCH_AT = "2000-01-01T00:00:00.000Z";

// this suite needs real transactions, so it runs its own replica set rather than the
// shared standalone harness. it proves the guarantee prod relies on: money and its
// history commit together or not at all. every transaction-dependent test lives here so
// only one replica set spins up (a second one starves the timing-sensitive round tests).
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { uniqueSuffix, betOnDays } = require("./helpers");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const Marketplace = require("../../models/Marketplace");
const MissionState = require("../../models/MissionState");
const { purchaseListing } = require("../../utils/market");
const { claimMission } = require("../../utils/missions");
const {
  chargeUser, creditUser, probeTransactions, setTransactionsSupported, transactionsSupported, TX,
} = require("../../utils/economy");

let rs;

beforeAll(async () => {
  rs = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(rs.getUri());
  setTransactionsSupported(await probeTransactions());
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([
    User.deleteMany({}), Transaction.deleteMany({}), Marketplace.deleteMany({}), MissionState.deleteMany({}),
  ]);
});

const listItem = (sellerId, price) => {
  const s = uniqueSuffix();
  return Marketplace.create({
    sellerId, item: new mongoose.Types.ObjectId(), case: new mongoose.Types.ObjectId(),
    uniqueId: `uq-${s}`, price, itemName: "thing", itemImage: "x", rarity: "3",
  });
};

afterAll(async () => {
  setTransactionsSupported(false);
  await mongoose.disconnect();
  await rs.stop();
});

const makeUser = (walletBalance) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
};

test("the replica set actually supports transactions", () => {
  expect(transactionsSupported()).toBe(true);
});

test("a successful charge moves the balance and writes exactly one row", async () => {
  const u = await makeUser(1000);
  const res = await chargeUser(u._id, 100, { awardXp: false, type: TX.CRASH_BET });
  expect(res).not.toBeNull();
  expect((await User.findById(u._id)).walletBalance).toBe(900);
  expect(await Transaction.countDocuments({ userId: u._id })).toBe(1);
});

test("a charge whose ledger row fails leaves the balance untouched", async () => {
  const u = await makeUser(1000);
  jest.spyOn(Transaction, "create").mockRejectedValueOnce(new Error("row write failed"));

  const res = await chargeUser(u._id, 100, { awardXp: false, type: TX.CRASH_BET });

  expect(res).toBeNull(); // the caller sees a failed charge
  expect((await User.findById(u._id)).walletBalance).toBe(1000); // rolled back
  expect(await Transaction.countDocuments({ userId: u._id })).toBe(0); // no history
});

test("a credit whose ledger row fails leaves the balance untouched", async () => {
  const u = await makeUser(1000);
  jest.spyOn(Transaction, "create").mockRejectedValueOnce(new Error("row write failed"));

  const res = await creditUser(u._id, 250, 0, { type: TX.CRASH_CASHOUT });

  expect(res).toBeNull();
  expect((await User.findById(u._id)).walletBalance).toBe(1000);
  expect(await Transaction.countDocuments({ userId: u._id })).toBe(0);
});

test("insufficient funds writes nothing and does not throw", async () => {
  const u = await makeUser(50);
  const res = await chargeUser(u._id, 100, { awardXp: false, type: TX.CRASH_BET });
  expect(res).toBeNull();
  expect((await User.findById(u._id)).walletBalance).toBe(50);
  expect(await Transaction.countDocuments({ userId: u._id })).toBe(0);
});

test("many concurrent charges each get their own row and never overspend", async () => {
  const u = await makeUser(1000);
  const results = await Promise.all(
    Array.from({ length: 20 }, () => chargeUser(u._id, 100, { awardXp: false, type: TX.SLOT_BET }))
  );
  const ok = results.filter(Boolean).length;
  const balance = (await User.findById(u._id)).walletBalance;
  const rows = await Transaction.countDocuments({ userId: u._id });
  expect(ok).toBe(10); // exactly ten of twenty could be covered
  expect(balance).toBe(0);
  expect(rows).toBe(ok); // one row per successful charge, none for the refused ones
});

test("a completed purchase moves both wallets and writes both rows", async () => {
  const seller = await makeUser(0);
  const buyer = await makeUser(1000);
  const listing = await listItem(seller._id, 100);

  const res = await purchaseListing({ listingId: listing._id, buyerId: buyer._id });
  expect(res.ok).toBe(true);

  expect((await User.findById(buyer._id)).walletBalance).toBe(900);
  expect((await User.findById(seller._id)).walletBalance).toBe(95); // net of the 5% fee
  expect(await Marketplace.countDocuments({ _id: listing._id })).toBe(0); // listing consumed
});

test("a buyer row failure charges nobody and leaves the listing on the market", async () => {
  const seller = await makeUser(0);
  const buyer = await makeUser(1000);
  const listing = await listItem(seller._id, 100);

  jest.spyOn(Transaction, "create").mockRejectedValueOnce(new Error("row write failed"));

  const res = await purchaseListing({ listingId: listing._id, buyerId: buyer._id });

  expect(res.ok).toBe(false);
  expect((await User.findById(buyer._id)).walletBalance).toBe(1000); // not charged
  expect((await User.findById(buyer._id)).inventory).toHaveLength(0); // item not granted
  expect(await Marketplace.countDocuments({ _id: listing._id })).toBe(1); // still for sale
  expect(await Transaction.countDocuments({})).toBe(0); // no history at all
});

test("two concurrent buyers cannot both win the same listing", async () => {
  const seller = await makeUser(0);
  const a = await makeUser(1000);
  const b = await makeUser(1000);
  const listing = await listItem(seller._id, 100);

  const results = await Promise.all([
    purchaseListing({ listingId: listing._id, buyerId: a._id }),
    purchaseListing({ listingId: listing._id, buyerId: b._id }),
  ]);

  const wins = results.filter((r) => r.ok).length;
  const balances = [(await User.findById(a._id)).walletBalance, (await User.findById(b._id)).walletBalance].sort((x, y) => x - y);
  expect(wins).toBe(1); // exactly one buyer wins
  expect(balances).toEqual([900, 1000]); // the winner paid, the loser kept everything
  expect(await Marketplace.countDocuments({})).toBe(0); // the listing is consumed
  expect((await User.findById(seller._id)).walletBalance).toBe(95); // seller paid once
});

// a user who has opened a case (so "first-case" is complete) with an empty mission state
const REWARD = 250; // the "first-case" mission reward
async function claimableUser(walletBalance = 1000) {
  const u = await makeUser(walletBalance);
  await Transaction.create({ userId: u._id, type: TX.CASE_OPEN, direction: "debit", amount: 100, meta: { quantity: 1 } });
  await MissionState.create({ userId: u._id });
  return u;
}
const claimedKeys = async (userId) => (await MissionState.findOne({ userId })).claimed;

test("a failed mission credit does not burn the reward: it stays claimable", async () => {
  const u = await claimableUser(1000);
  jest.spyOn(Transaction, "create").mockRejectedValueOnce(new Error("row write failed"));

  const res = await claimMission(u._id, "first-case", null);

  expect(res.code).toBe(500);
  expect(await claimedKeys(u._id)).not.toContain("first-case"); // the mark rolled back
  expect((await User.findById(u._id)).walletBalance).toBe(1000); // nothing paid
  expect(await Transaction.countDocuments({ userId: u._id, type: TX.MISSION_REWARD })).toBe(0);
});

test("retrying after a failed mission credit pays the reward exactly once", async () => {
  const u = await claimableUser(1000);
  jest.spyOn(Transaction, "create").mockRejectedValueOnce(new Error("row write failed"));
  await claimMission(u._id, "first-case", null); // fails, rolls back
  jest.restoreAllMocks();

  const res = await claimMission(u._id, "first-case", null); // retry
  expect(res.body.claimed).toBe(true);
  expect((await User.findById(u._id)).walletBalance).toBe(1000 + REWARD);

  const again = await claimMission(u._id, "first-case", null);
  expect(again.body.alreadyClaimed).toBe(true);
  expect((await User.findById(u._id)).walletBalance).toBe(1000 + REWARD);
});

test("concurrent mission claims pay the reward exactly once", async () => {
  const u = await claimableUser(1000);

  const results = await Promise.all([
    claimMission(u._id, "first-case", null),
    claimMission(u._id, "first-case", null),
  ]);

  expect(results.filter((r) => r.body.claimed).length).toBe(1);
  expect((await User.findById(u._id)).walletBalance).toBe(1000 + REWARD);
  expect(await Transaction.countDocuments({ userId: u._id, type: TX.MISSION_REWARD })).toBe(1);
});

const { claimCommission } = require("../../utils/referrals");

// a referrer with one verified referee who has wagered enough to earn commission
async function referrerWithEarnings(wagered) {
  const me = await makeUser(0);
  const referee = await makeUser(1000);
  await User.updateOne({ _id: referee._id }, { $set: { referredBy: me._id, emailVerifiedAt: new Date() } });
  await Transaction.create({ userId: referee._id, type: TX.CRASH_BET, direction: "debit", amount: wagered });
  return me;
}

test("a failed commission credit rolls the claimed counter back", async () => {
  const me = await referrerWithEarnings(1000); // 10 earned
  jest.spyOn(Transaction, "create").mockRejectedValueOnce(new Error("row write failed"));

  const res = await claimCommission(me._id);

  expect(res.code).toBe(500);
  const after = await User.findById(me._id);
  expect(after.referralClaimed || 0).toBe(0); // the counter rolled back
  expect(after.walletBalance).toBe(0); // nothing paid
  jest.restoreAllMocks();

  const retry = await claimCommission(me._id); // still all claimable
  expect(retry.code).toBe(200);
  expect(retry.body.claimed).toBe(10);
  expect((await User.findById(me._id)).walletBalance).toBe(10);
});

test("concurrent commission claims pay exactly once", async () => {
  const me = await referrerWithEarnings(1000);

  const results = await Promise.all([claimCommission(me._id), claimCommission(me._id)]);

  expect(results.filter((r) => r.code === 200).length).toBe(1);
  expect((await User.findById(me._id)).walletBalance).toBe(10);
  expect((await User.findById(me._id)).referralClaimed).toBe(10);
  expect(await Transaction.countDocuments({ userId: me._id, type: TX.REFERRAL_COMMISSION })).toBe(1);
});

const { maybePayReferralMilestone, MILESTONE_LEVEL, MILESTONE_DAYS, MILESTONE_BONUS } = require("../../utils/referrals");

// only a verified referee earns the referrer anything
async function referredPair() {
  const referrer = await makeUser(0);
  const referee = await makeUser(1000);
  await User.updateOne({ _id: referee._id }, { $set: { referredBy: referrer._id, emailVerifiedAt: new Date() } });
  return { referrer, referee };
}

// and the milestone also wants the level and a week of play
async function dueForMilestone() {
  const pair = await referredPair();
  await User.updateOne({ _id: pair.referee._id }, { $set: { level: MILESTONE_LEVEL } });
  await betOnDays(pair.referee._id, MILESTONE_DAYS);
  return pair;
}

test("a failed milestone credit rolls the paid flag back", async () => {
  const { referrer, referee } = await dueForMilestone();
  jest.spyOn(Transaction, "create").mockRejectedValueOnce(new Error("row write failed"));

  await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL); // swallows the abort

  expect((await User.findById(referee._id)).referralMilestonePaid).not.toBe(true); // still owed
  expect((await User.findById(referrer._id)).walletBalance).toBe(0);
  jest.restoreAllMocks();

  await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL); // the next level event pays
  expect((await User.findById(referrer._id)).walletBalance).toBe(MILESTONE_BONUS);
});

const { settleOnVerified, REFERRER_SIGNUP_BONUS } = require("../../utils/referrals");

test("a failed referrer bonus credit leaves the bonus owed", async () => {
  const { referrer, referee } = await referredPair();
  await User.updateOne({ _id: referee._id }, { $set: { referralBonusPending: true } });
  jest.spyOn(Transaction, "create").mockRejectedValueOnce(new Error("row write failed"));

  await settleOnVerified(referee._id); // swallows the abort

  expect((await User.findById(referee._id)).referralBonusPending).toBe(true); // still owed
  expect((await User.findById(referrer._id)).walletBalance).toBe(0);
  jest.restoreAllMocks();

  await settleOnVerified(referee._id);
  expect((await User.findById(referrer._id)).walletBalance).toBe(REFERRER_SIGNUP_BONUS);
  expect((await User.findById(referee._id)).referralBonusPending).toBeUndefined();
});

test("concurrent verifications pay the referrer bonus exactly once", async () => {
  const { referrer, referee } = await referredPair();
  await User.updateOne({ _id: referee._id }, { $set: { referralBonusPending: true } });

  await Promise.all([settleOnVerified(referee._id), settleOnVerified(referee._id)]);

  expect((await User.findById(referrer._id)).walletBalance).toBe(REFERRER_SIGNUP_BONUS);
  expect(await Transaction.countDocuments({ userId: referrer._id, type: TX.REFERRAL_BONUS })).toBe(1);
});

test("concurrent milestone triggers pay exactly once", async () => {
  const { referrer, referee } = await dueForMilestone();

  await Promise.all([
    maybePayReferralMilestone(referee._id, MILESTONE_LEVEL),
    maybePayReferralMilestone(referee._id, MILESTONE_LEVEL),
  ]);

  expect((await User.findById(referrer._id)).walletBalance).toBe(MILESTONE_BONUS);
  expect(await Transaction.countDocuments({ userId: referrer._id, type: TX.REFERRAL_MILESTONE })).toBe(1);
});

const LotteryDraw = require("../../models/LotteryDraw");
const LotteryTicket = require("../../models/LotteryTicket");
const LotteryEntry = require("../../models/LotteryEntry");
const lottery = require("../../games/lottery");
const { settleDue } = require("../../games/lotteryDraw");
const lotteryMath = require("../../utils/lotteryMath");
const memo = require("../../utils/memo");
const noIo = { emit: () => {}, to: () => ({ emit: () => {} }) };

const freshLottery = async () => {
  await Promise.all([LotteryDraw.init(), LotteryTicket.init(), LotteryEntry.init()]);
  await Promise.all([LotteryDraw.deleteMany({}), LotteryTicket.deleteMany({}), LotteryEntry.deleteMany({})]);
  memo.clear();
  await lottery.ensureOpenDraw();
  await LotteryDraw.updateOne({ number: 1 }, { $set: { drawAt: new Date(Date.now() + 3600 * 1000) } });
};

const { JACKPOT_BASE, JACKPOT_SHARE } = lotteryMath;
const potOf = () => LotteryDraw.findOne({ number: 1 }, { status: 1, jackpot: 1, tickets: 1 }).lean();
const capOf = async (user) => ((await LotteryEntry.findOne({ userId: user._id }).lean()) || { count: 0 }).count;

test("a burst of lottery buyers each ends with their tickets, their charge and their share of the pot, committed together", async () => {
  await freshLottery();
  const users = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser(10000)));
  const results = await Promise.all(users.map((user) => lottery.buyTickets({ user, picks: [[1, 2, 3], [4, 5, 6]], io: noIo })));
  expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
  const draw = await LotteryDraw.findOne({ number: 1 }).lean();
  expect(draw.tickets).toBe(10);
  expect(draw.jackpot).toBe(JACKPOT_BASE + 10 * JACKPOT_SHARE);
  expect(await LotteryTicket.countDocuments({ draw: 1 })).toBe(10);
  for (const user of users) {
    expect((await User.findById(user._id)).walletBalance).toBe(9800);
    expect(await Transaction.countDocuments({ userId: user._id, type: TX.LOTTERY_TICKET })).toBe(1);
    expect(await LotteryTicket.countDocuments({ userId: user._id })).toBe(2);
  }
});

test("a lottery purchase whose tickets fail to write inside the transaction leaves nothing behind", async () => {
  await freshLottery();
  const user = await makeUser(10000);
  jest.spyOn(LotteryTicket, "insertMany").mockRejectedValueOnce(new Error("write failed"));
  jest.spyOn(console, "error").mockImplementation(() => {});

  const res = await lottery.buyTickets({ user, picks: [[1, 2, 3], [4, 5, 6]], io: noIo });

  expect(res.status).toBe(503);
  // nothing was taken, so the answer does not speak of a refund
  expect(res.body).toEqual({ reason: "busy", message: "Those tickets could not be bought, try again" });
  const after = await User.findById(user._id);
  expect(after.walletBalance).toBe(10000);
  expect(after.xp).toBe(0); // the stake's xp went back with the charge
  expect(await Transaction.countDocuments({ userId: user._id })).toBe(0); // no charge row, and no refund row either
  expect(await potOf()).toMatchObject({ status: "open", jackpot: JACKPOT_BASE, tickets: 0 });
  expect(await LotteryTicket.countDocuments({})).toBe(0);
  expect(await capOf(user)).toBe(0);
});

test("a lottery purchase the wallet cannot cover leaves the pot untouched", async () => {
  await freshLottery();
  const user = await makeUser(150);

  const res = await lottery.buyTickets({ user, picks: [[1, 2, 3], [4, 5, 6]], io: noIo });

  expect(res.status).toBe(400);
  expect(res.body.reason).toBe("funds");
  expect((await User.findById(user._id)).walletBalance).toBe(150);
  expect(await Transaction.countDocuments({ userId: user._id })).toBe(0);
  expect(await potOf()).toMatchObject({ status: "open", jackpot: JACKPOT_BASE, tickets: 0 });
  expect(await LotteryTicket.countDocuments({})).toBe(0);
  expect(await capOf(user)).toBe(0);
});

test("a lottery purchase retried after a write conflict charges, fills the pot and writes its tickets once", async () => {
  await freshLottery();
  const user = await makeUser(10000);
  const spy = jest.spyOn(LotteryTicket, "insertMany").mockImplementationOnce(() => {
    const conflict = new mongoose.mongo.MongoError("write conflict");
    conflict.addErrorLabel("TransientTransactionError");
    return Promise.reject(conflict);
  });

  const res = await lottery.buyTickets({ user, picks: [[1, 2, 3], [4, 5, 6]], io: noIo });

  expect(res.status).toBe(200);
  expect(spy).toHaveBeenCalledTimes(2); // the whole purchase ran twice, the first attempt took nothing
  expect((await User.findById(user._id)).walletBalance).toBe(9800);
  expect(await Transaction.countDocuments({ userId: user._id })).toBe(1);
  expect(await potOf()).toMatchObject({ jackpot: JACKPOT_BASE + 2 * JACKPOT_SHARE, tickets: 2 });
  expect(await LotteryTicket.countDocuments({ userId: user._id })).toBe(2);
  expect(res.body.draw).toEqual({ number: 1, jackpot: JACKPOT_BASE + 2 * JACKPOT_SHARE, tickets: 2 });
});

// three numbers the draw will not draw, so a scored ticket pays nothing and the wallet shows only the charge
const missingPick = async () => {
  const drawn = lotteryMath.drawNumbers((await LotteryDraw.findOne({ number: 1 }).select("+serverSeed").lean()).serverSeed, 1);
  return Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => !drawn.includes(n)).slice(0, 3);
};

// a purchase that raced the settlement: all its tickets in the scored draw and charged, or refused with nothing taken
async function expectWholeOrNothing(user, res, n) {
  const draw = await LotteryDraw.findOne({ number: 1 }).lean();
  const tickets = await LotteryTicket.find({ draw: 1 }).lean();
  const rows = await Transaction.find({ userId: user._id }).lean();
  const wallet = (await User.findById(user._id)).walletBalance;
  expect(draw.status).toBe("settled");
  if (res.status === 200) {
    expect(res.body.draw.number).toBe(1);
    expect(tickets).toHaveLength(n);
    expect(tickets.every((t) => t.matches === 0)).toBe(true); // every one of them was scored
    expect(draw).toMatchObject({ tickets: n, jackpot: JACKPOT_BASE + n * JACKPOT_SHARE });
    expect(rows.map((r) => [r.type, r.amount])).toEqual([[TX.LOTTERY_TICKET, 100 * n]]);
    expect(wallet).toBe(10000 - 100 * n);
  } else {
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe("closed");
    expect(tickets).toHaveLength(0);
    expect(draw).toMatchObject({ tickets: 0, jackpot: JACKPOT_BASE });
    expect(rows).toHaveLength(0);
    expect(wallet).toBe(10000);
    expect(await capOf(user)).toBe(0);
  }
}

test("a lottery purchase and a settlement started together never leave tickets charged but unscored", async () => {
  const due = async () => new Date(new Date((await LotteryDraw.findOne({ number: 1 }).lean()).drawAt).getTime() + 1000);

  // the settlement starts while the purchase's transaction is open: its switch to drawing waits for the commit
  await freshLottery();
  const inside = await makeUser(10000);
  const pick = await missingPick();
  const insert = LotteryTicket.insertMany.bind(LotteryTicket);
  let settling;
  let seenMeanwhile;
  jest.spyOn(LotteryTicket, "insertMany").mockImplementationOnce(async (...args) => {
    settling = settleDue(noIo, { now: await due(), revealMs: 0 });
    await new Promise((resolve) => setTimeout(resolve, 150));
    seenMeanwhile = (await potOf()).status;
    return insert(...args);
  });
  const bought = await lottery.buyTickets({ user: inside, picks: [pick, pick], io: noIo });
  await settling;
  expect(seenMeanwhile).toBe("open");
  expect(bought.status).toBe(200);
  await expectWholeOrNothing(inside, bought, 2);
  jest.restoreAllMocks();

  // the settlement lands between the sales check and the transaction: the purchase is refused and nothing is taken
  await freshLottery();
  const before = await makeUser(10000);
  const claim = LotteryEntry.findOneAndUpdate.bind(LotteryEntry);
  const at = await due();
  jest.spyOn(LotteryEntry, "findOneAndUpdate").mockImplementationOnce((...args) => ({
    lean: () => settleDue(noIo, { now: at, revealMs: 0 }).then(() => claim(...args).lean()),
  }));
  const refused = await lottery.buyTickets({ user: before, picks: [[1, 2, 3]], io: noIo });
  expect(refused.status).toBe(409);
  await expectWholeOrNothing(before, refused, 1);
  jest.restoreAllMocks();

  // and started at the same moment, a few times over, whichever wins
  for (const wait of [0, 2, 5, 10, 20]) {
    await freshLottery();
    const user = await makeUser(10000);
    const picks = [await missingPick()];
    const [res] = await Promise.all([
      lottery.buyTickets({ user, picks, io: noIo }),
      due().then((now) => new Promise((resolve) => setTimeout(resolve, wait)).then(() => settleDue(noIo, { now, revealMs: 0 }))),
    ]);
    await expectWholeOrNothing(user, res, 1);
  }
});

test("a committed lottery purchase runs the referral check once, and a refused one does not", async () => {
  await freshLottery();
  const referrals = require("../../utils/referrals");
  const hook = jest.spyOn(referrals, "maybePayReferralMilestone").mockResolvedValue(undefined);
  const user = await makeUser(10000);

  expect((await lottery.buyTickets({ user, picks: [[1, 2, 3]], io: noIo })).status).toBe(200);
  expect(hook).toHaveBeenCalledTimes(1);
  const [id, level, known] = hook.mock.calls[0];
  expect(String(id)).toBe(String(user._id));
  expect(level).toBe((await User.findById(user._id)).level);
  expect(known.walletBalance).toBe(9900);

  const broke = await makeUser(50);
  expect((await lottery.buyTickets({ user: broke, picks: [[1, 2, 3]], io: noIo })).status).toBe(400);
  expect(hook).toHaveBeenCalledTimes(1);
});

test("a lottery payout whose ledger row fails rolls its claim back with it, and the resumed draw pays it once", async () => {
  await freshLottery();
  const user = await makeUser(10000);
  const drawn = lotteryMath.drawNumbers((await LotteryDraw.findOne({ number: 1 }).select("+serverSeed").lean()).serverSeed, 1);
  const other = Array.from({ length: 20 }, (_, i) => i + 1).find((n) => !drawn.includes(n));
  await lottery.buyTickets({ user, picks: [[drawn[0], drawn[1], other]], io: noIo });
  await LotteryDraw.updateOne({ number: 1 }, { $set: { drawAt: new Date(Date.now() - 1000) } });

  const create = Transaction.create.bind(Transaction);
  let failed = false;
  jest.spyOn(Transaction, "create").mockImplementation((docs, ...rest) => {
    const doc = Array.isArray(docs) ? docs[0] : docs;
    if (!failed && doc && doc.type === TX.LOTTERY_WIN) {
      failed = true;
      return Promise.reject(new Error("row write failed"));
    }
    return create(docs, ...rest);
  });
  jest.spyOn(console, "error").mockImplementation(() => {});

  const first = await settleDue(noIo, { revealMs: 0 });
  expect(first.error).toBeTruthy();
  expect((await LotteryEntry.findOne({ userId: user._id }).lean()).paid).toBe(false);
  expect((await User.findById(user._id)).walletBalance).toBe(9900);
  jest.restoreAllMocks();

  const second = await settleDue(noIo, { revealMs: 0 });
  expect(second.error).toBeUndefined();
  const wins = await Transaction.find({ userId: user._id, type: TX.LOTTERY_WIN }).lean();
  expect(wins.map((r) => r.amount)).toEqual([300]);
  expect((await User.findById(user._id)).walletBalance).toBe(10200);
  expect((await LotteryDraw.findOne({ number: 1 }).lean()).status).toBe("settled");
});
