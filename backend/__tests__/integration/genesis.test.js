process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const { chargeUser, creditUser, TX } = require("../../utils/economy");
const { bookGenesis } = require("../../scripts/genesis");
const { reconcile } = require("../../scripts/reconcile");
const { GENESIS } = require("../../utils/accounts");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (walletBalance) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
};

test("genesis books the pre-ledger balance and drives reconcile to zero", async () => {
  // a legacy account: wallet, no history at all
  const legacy = await makeUser(700);
  // a legacy account that also has post-ledger activity
  const mixed = await makeUser(1000);
  await chargeUser(mixed._id, 300, { awardXp: false, type: TX.CRASH_BET }); // wallet 700, derived -300
  // a fully post-ledger account, created and funded through the ledger
  const fresh = await makeUser(0);
  await creditUser(fresh._id, 500, 0, { type: TX.BONUS }); // wallet 500, derived 500, no drift

  const before = await reconcile();
  expect(before.players.drifting).toBe(2); // legacy and mixed drift; fresh does not

  const report = await bookGenesis();
  expect(report.booked).toBe(2);
  expect(report.openedTotal).toBe(700 + 1000); // each account's true pre-ledger opening

  const after = await reconcile();
  expect(after.players.drifting).toBe(0);
  expect(after.players.totalDrift).toBe(0);
  expect(after.conservation).toBe(0); // the books balance across every account
  expect(after.system.genesis).toBe(-(700 + 1000)); // genesis holds the pre-ledger supply
});

test("genesis is idempotent: a second run books nothing", async () => {
  await makeUser(700);
  await makeUser(250);

  const first = await bookGenesis();
  expect(first.booked).toBe(2);

  const second = await bookGenesis();
  expect(second.booked).toBe(0);
  expect(second.skipped).toBe(2);

  // exactly one opening row per account
  expect(await Transaction.countDocuments({ type: TX.OPENING })).toBe(2);
});

test("a balance that changes mid-backfill still reconciles", async () => {
  const u = await makeUser(1000);

  // the opening captures 1000; a bet after it must not break reconcile, because the bet
  // writes its own row atomically
  await bookGenesis();
  await chargeUser(u._id, 400, { awardXp: false, type: TX.SLOT_BET });

  const after = await reconcile();
  expect(after.players.drifting).toBe(0);
  expect((await User.findById(u._id)).walletBalance).toBe(600);
});

test("a dry run reports the opening without writing any rows", async () => {
  await makeUser(700);
  const report = await bookGenesis({ dryRun: true });
  expect(report.booked).toBe(1);
  expect(report.openedTotal).toBe(700);
  expect(await Transaction.countDocuments({ type: TX.OPENING })).toBe(0);
  expect(await reconcile().then((r) => r.players.drifting)).toBe(1); // still unreconciled
});

test("genesis leaves a fully post-ledger account untouched", async () => {
  const u = await makeUser(0);
  await creditUser(u._id, 200, 0, { type: TX.SIGNUP });

  const report = await bookGenesis();
  expect(report.booked).toBe(0);
  expect(await Transaction.exists({ userId: u._id, type: TX.OPENING })).toBeFalsy();
});
