process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const {
  chargeUser, creditUser, recordTransaction, accountBalance, ledgerSupply, TX,
} = require("../../utils/economy");
const { HOUSE, MINT, ESCROW, GENESIS, isSystemAccount } = require("../../utils/accounts");
const { purchaseListing } = require("../../utils/market");
const { reconcile } = require("../../scripts/reconcile");
const Marketplace = require("../../models/Marketplace");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (walletBalance = 0) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
};

// sum every account that appears in the ledger; a closed set of movements nets to zero
async function totalOfAllAccounts() {
  const ids = await Transaction.distinct("userId");
  const cps = await Transaction.distinct("counterparty");
  const all = new Set([...ids, ...cps].filter(Boolean).map(String));
  let total = 0;
  for (const id of all) total += await accountBalance(id);
  return total;
}

test("a mint, a bet and a win keep the house and mint balances correct", async () => {
  const u = await makeUser(0);

  // mint 1000 to the player (like a bonus): mint goes negative, player positive
  await creditUser(u._id, 1000, 0, { type: TX.BONUS });
  expect(await accountBalance(u._id)).toBe(1000);
  expect(await accountBalance(MINT)).toBe(-1000);
  expect(await ledgerSupply()).toBe(1000);

  // player bets 100 on crash and loses it: house keeps the 100
  await chargeUser(u._id, 100, { awardXp: false, type: TX.CRASH_BET });
  expect(await accountBalance(u._id)).toBe(900);
  expect(await accountBalance(HOUSE)).toBe(100);

  // player bets 100 and cashes out 150: house is now down 50 on the game
  await chargeUser(u._id, 100, { awardXp: false, type: TX.CRASH_BET });
  await creditUser(u._id, 150, 50, { type: TX.CRASH_CASHOUT });
  expect(await accountBalance(HOUSE)).toBe(100 + 100 - 150);
  expect(await accountBalance(u._id)).toBe(950);
});

test("the books balance to zero across every account after a closed set of moves", async () => {
  const a = await makeUser(0);
  const b = await makeUser(0);

  await creditUser(a._id, 500, 0, { type: TX.SIGNUP });
  await creditUser(b._id, 500, 0, { type: TX.BONUS });
  await chargeUser(a._id, 200, { awardXp: false, type: TX.SLOT_BET });
  await creditUser(a._id, 90, 0, { type: TX.SLOT_WIN });
  await creditUser(b._id, 40, 0, { type: TX.ITEM_SELL });

  expect(await totalOfAllAccounts()).toBe(0);
});

test("a marketplace sale splits into buyer, seller and house legs that net to zero", async () => {
  const seller = await makeUser(0);
  const buyer = await makeUser(1000);
  const caseId = new mongoose.Types.ObjectId();
  const listing = await Marketplace.create({
    sellerId: seller._id, item: new mongoose.Types.ObjectId(), case: caseId,
    uniqueId: `uq-${uniqueSuffix()}`, price: 100,
    itemName: "thing", itemImage: "x", rarity: "3",
  });

  const res = await purchaseListing({ listingId: listing._id, buyerId: buyer._id });
  expect(res.ok).toBe(true);

  // fee is floor(100 * 0.05) = 5, seller net 95, buyer paid 100
  expect(await accountBalance(buyer._id)).toBe(-100);
  expect(await accountBalance(seller._id)).toBe(95);
  expect(await accountBalance(HOUSE)).toBe(5);
  expect(await totalOfAllAccounts()).toBe(0);
});

test("escrow place then refund leaves escrow flat", async () => {
  const u = await makeUser(1000);
  await chargeUser(u._id, 300, { awardXp: false, type: TX.MARKET_ORDER });
  expect(await accountBalance(ESCROW)).toBe(300);
  await creditUser(u._id, 300, 0, { type: TX.MARKET_ORDER_REFUND });
  expect(await accountBalance(ESCROW)).toBe(0);
});

test("system accounts are never real user documents", async () => {
  for (const id of [HOUSE, MINT, ESCROW, GENESIS]) {
    expect(isSystemAccount(id)).toBe(true);
    expect(await User.findById(id)).toBeNull();
  }
});

test("reconcile flags a legacy drift and reports the system balances", async () => {
  await makeUser(700); // legacy: wallet 700, no ledger
  const clean = await makeUser(400);
  await creditUser(clean._id, 500, 0, { type: TX.BONUS }); // ledger now explains 500 of it

  const r = await reconcile();
  expect(r.players.total).toBe(2);
  // the legacy 700 has no opening row, and the clean player's wallet leads its ledger by 400
  expect(r.players.drifting).toBe(2);
  expect(r.players.totalDrift).toBe(700 + 400);
  expect(r.system.mint).toBe(-500);
  expect(r.system.supply).toBe(500);
});

test("a genesis opening row makes a legacy balance reconcile", async () => {
  // a player who existed before the ledger: wallet 700, no history
  const u = await makeUser(700);
  expect(await accountBalance(u._id)).toBe(0); // ledger cannot explain the 700 yet

  // book the opening position from genesis, the plug the backfill will write
  await recordTransaction({
    userId: u._id, type: "opening_balance", direction: "credit",
    amount: 700, counterparty: GENESIS,
  });
  expect(await accountBalance(u._id)).toBe(700);
  expect(await accountBalance(GENESIS)).toBe(-700);
});
