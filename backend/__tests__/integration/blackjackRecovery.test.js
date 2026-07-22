process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, io, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Roll = require("../../models/Roll");
const Seed = require("../../models/Seed");
const Transaction = require("../../models/Transaction");
const BlackjackHand = require("../../models/BlackjackHand");
const { sweepBlackjackHands } = require("../../games/blackjack");
const { TX } = require("../../utils/economy");
const { hashServerSeed } = require("../../utils/provablyFair");
const { drawCard, rankOf, isBlackjack } = require("../../utils/blackjackMath");

let app;

beforeAll(async () => {
  await setupDb();
  await Promise.all([Seed.syncIndexes(), Roll.syncIndexes(), BlackjackHand.syncIndexes()]);
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const SERVER_SEED = "e".repeat(64);
const OLD = new Date(Date.now() - 30 * 60 * 1000);

async function makeUser(walletBalance = 1000) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
}

async function pinSeed(userId, wantFn) {
  let clientSeed = null;
  for (let i = 0; i < 100000 && clientSeed === null; i++) {
    const candidate = `pin-${i}`;
    const p = [drawCard(SERVER_SEED, candidate, 0, 0), drawCard(SERVER_SEED, candidate, 0, 2)];
    const d = [drawCard(SERVER_SEED, candidate, 0, 1), drawCard(SERVER_SEED, candidate, 0, 3)];
    if (wantFn(p, d, candidate)) clientSeed = candidate;
  }
  expect(clientSeed).not.toBeNull();
  await Seed.create({ userId, serverSeed: SERVER_SEED, serverSeedHash: hashServerSeed(SERVER_SEED), clientSeed });
}

const noNaturals = (p, d) => rankOf(d[0]) !== 0 && !isBlackjack(p) && !isBlackjack(d);

// bypass mongoose timestamps so a hand can be made to look abandoned
async function backdate(handId, extra = {}) {
  await BlackjackHand.collection.updateOne(
    { handId },
    { $set: { updatedAt: OLD, ...extra } }
  );
}

test("a stale active hand is auto-stood, settled, and paid exactly once", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, noNaturals);

  const deal = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  await backdate(deal.body.handId);

  await sweepBlackjackHands(io);
  const hand = await BlackjackHand.findOne({ handId: deal.body.handId });
  expect(hand.status).toBe("settled");
  expect(hand.settlementDone).toBe(true);
  expect(hand.actions[hand.actions.length - 1]).toMatchObject({ action: "stand", auto: true });
  expect(hand.rollId).toMatch(/^R\d+$/);
  expect(await Roll.findOne({ rollId: hand.rollId })).toBeTruthy();

  const walletAfterFirst = (await User.findById(u._id)).walletBalance;
  expect(walletAfterFirst).toBe(900 + hand.totalPayout);

  // idempotent: a second sweep moves no more money
  await sweepBlackjackHands(io);
  expect((await User.findById(u._id)).walletBalance).toBe(walletAfterFirst);
  const credits = await Transaction.countDocuments({
    userId: u._id,
    type: { $in: [TX.BLACKJACK_WIN, TX.BLACKJACK_PUSH] },
  });
  expect(credits).toBe(hand.totalPayout > 0 ? 1 : 0);
});

test("a settled-but-unpaid hand is paid from what the ledger says is missing", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, noNaturals);

  const deal = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  // simulate a crash after the settle write but before the credit
  await BlackjackHand.collection.updateOne(
    { handId: deal.body.handId },
    {
      $set: {
        status: "settled",
        totalPayout: 200,
        "hands.0.outcome": "win",
        "hands.0.payout": 200,
        dealerTotal: 17,
        settledAt: OLD,
        settlementStartedAt: OLD,
        settlementDone: false,
      },
    }
  );

  await sweepBlackjackHands(io);
  expect((await User.findById(u._id)).walletBalance).toBe(900 + 200);
  expect((await BlackjackHand.findOne({ handId: deal.body.handId })).settlementDone).toBe(true);

  await sweepBlackjackHands(io);
  expect((await User.findById(u._id)).walletBalance).toBe(1100);
});

test("an unfunded active hand is voided with nothing credited", async () => {
  const u = await makeUser(1000);
  await pinSeed(u._id, noNaturals);
  const seed = await Seed.findOne({ userId: u._id });

  // a hand doc with no matching bet row: the crash window between create and charge
  await BlackjackHand.create({
    handId: "BJ000000001",
    userId: u._id,
    betAmount: 100,
    hands: [{ cards: [5, 8], bet: 100 }],
    dealerCards: [9, 20],
    seedId: seed._id,
    clientSeed: seed.clientSeed,
    serverSeedHash: seed.serverSeedHash,
    nonce: 0,
  });
  await backdate("BJ000000001");

  await sweepBlackjackHands(io);
  const hand = await BlackjackHand.findOne({ handId: "BJ000000001" });
  expect(hand.status).toBe("voided");
  expect((await User.findById(u._id)).walletBalance).toBe(1000);
  expect(await Transaction.countDocuments({ userId: u._id })).toBe(0);
});

test("a crashed double claim without a charge is dropped and the hand stood out", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, noNaturals);

  const deal = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  await backdate(deal.body.handId, { pendingAction: "double", pendingAt: OLD });
  await sweepBlackjackHands(io);

  const hand = await BlackjackHand.findOne({ handId: deal.body.handId });
  expect(hand.status).toBe("settled");
  expect(hand.pendingAction).toBeNull();
  // the unpaid double never happened: original stake, two cards, auto-stood
  expect(hand.hands[0].doubled).toBe(false);
  expect(hand.hands[0].bet).toBe(100);
  expect(hand.actions.some((a) => a.action === "stand" && a.auto)).toBe(true);
});

test("a crashed double claim with the charge landed completes as doubled", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, noNaturals);

  const deal = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  await Transaction.create({
    userId: u._id,
    type: TX.BLACKJACK_BET,
    direction: "debit",
    amount: 100,
    meta: { handId: deal.body.handId, betAmount: 100, double: true },
  });
  await backdate(deal.body.handId, { pendingAction: "double", pendingAt: OLD });
  await sweepBlackjackHands(io);

  const hand = await BlackjackHand.findOne({ handId: deal.body.handId });
  expect(hand.status).toBe("settled");
  expect(hand.hands[0].doubled).toBe(true);
  expect(hand.hands[0].bet).toBe(200);
  expect(hand.hands[0].cards).toHaveLength(3);
  expect(hand.actions.some((a) => a.action === "double" && a.auto)).toBe(true);
});

test("a stale hand awaiting insurance is auto-declined and stood out", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, (p, d) => rankOf(d[0]) === 0 && !isBlackjack(p) && !isBlackjack(d));

  const deal = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  expect(deal.body.awaitingInsurance).toBe(true);
  await backdate(deal.body.handId);

  await sweepBlackjackHands(io);
  const hand = await BlackjackHand.findOne({ handId: deal.body.handId });
  expect(hand.status).toBe("settled");
  expect(hand.insuranceBet).toBe(0);
  const acts = hand.actions.map((a) => a.action);
  expect(acts).toContain("noinsure");
  expect(hand.settlementDone).toBe(true);
});
