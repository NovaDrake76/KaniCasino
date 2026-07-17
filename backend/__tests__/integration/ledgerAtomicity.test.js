process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// this suite needs real transactions, so it runs its own replica set rather than the
// shared standalone harness. it proves the guarantee prod relies on: money and its
// history commit together or not at all.
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
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
  await User.deleteMany({});
  await Transaction.deleteMany({});
});

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
