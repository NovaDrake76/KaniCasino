process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.MISSIONS_LAUNCH_AT = "2000-01-01T00:00:00.000Z";

// this suite needs real transactions, so it runs its own replica set rather than the
// shared standalone harness. it proves the guarantee prod relies on: money and its
// history commit together or not at all. every transaction-dependent test lives here so
// only one replica set spins up (a second one starves the timing-sensitive round tests).
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { uniqueSuffix } = require("./helpers");
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

// a referrer with one referee who has wagered enough to earn commission
async function referrerWithEarnings(wagered) {
  const me = await makeUser(0);
  const referee = await makeUser(1000);
  await User.updateOne({ _id: referee._id }, { $set: { referredBy: me._id } });
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

const { maybePayReferralMilestone, MILESTONE_LEVEL, MILESTONE_BONUS } = require("../../utils/referrals");

async function referredPair() {
  const referrer = await makeUser(0);
  const referee = await makeUser(1000);
  await User.updateOne({ _id: referee._id }, { $set: { referredBy: referrer._id } });
  return { referrer, referee };
}

test("a failed milestone credit rolls the paid flag back", async () => {
  const { referrer, referee } = await referredPair();
  jest.spyOn(Transaction, "create").mockRejectedValueOnce(new Error("row write failed"));

  await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL); // swallows the abort

  expect((await User.findById(referee._id)).referralMilestonePaid).not.toBe(true); // still owed
  expect((await User.findById(referrer._id)).walletBalance).toBe(0);
  jest.restoreAllMocks();

  await maybePayReferralMilestone(referee._id, MILESTONE_LEVEL); // the next level event pays
  expect((await User.findById(referrer._id)).walletBalance).toBe(MILESTONE_BONUS);
});

test("concurrent milestone triggers pay exactly once", async () => {
  const { referrer, referee } = await referredPair();

  await Promise.all([
    maybePayReferralMilestone(referee._id, MILESTONE_LEVEL),
    maybePayReferralMilestone(referee._id, MILESTONE_LEVEL),
  ]);

  expect((await User.findById(referrer._id)).walletBalance).toBe(MILESTONE_BONUS);
  expect(await Transaction.countDocuments({ userId: referrer._id, type: TX.REFERRAL_MILESTONE })).toBe(1);
});
