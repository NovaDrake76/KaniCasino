process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Roll = require("../../models/Roll");
const Seed = require("../../models/Seed");
const Transaction = require("../../models/Transaction");
const BlackjackHand = require("../../models/BlackjackHand");
const { TX } = require("../../utils/economy");
const { hashServerSeed } = require("../../utils/provablyFair");
const { drawCard, rankOf, handTotal, isBlackjack, naturalPayout, insurancePayout } = require("../../utils/blackjackMath");

let app;

beforeAll(async () => {
  await setupDb();
  await Promise.all([Seed.syncIndexes(), Roll.syncIndexes(), BlackjackHand.syncIndexes()]);
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeUser(walletBalance = 1000) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
}

const SERVER_SEED = "d".repeat(64);

// pin the user's seed so the next deal (nonce 0) produces a wanted card pattern
async function pinSeed(userId, wantFn) {
  let clientSeed = null;
  for (let i = 0; i < 100000 && clientSeed === null; i++) {
    const candidate = `pin-${i}`;
    const p = [drawCard(SERVER_SEED, candidate, 0, 0), drawCard(SERVER_SEED, candidate, 0, 2)];
    const d = [drawCard(SERVER_SEED, candidate, 0, 1), drawCard(SERVER_SEED, candidate, 0, 3)];
    if (wantFn(p, d, candidate)) clientSeed = candidate;
  }
  expect(clientSeed).not.toBeNull();
  await Seed.create({
    userId,
    serverSeed: SERVER_SEED,
    serverSeedHash: hashServerSeed(SERVER_SEED),
    clientSeed,
  });
  return clientSeed;
}

const noNaturals = (p, d) => rankOf(d[0]) !== 0 && !isBlackjack(p) && !isBlackjack(d);
// an opener a hit can never bust or auto-settle from (total after one hit stays under 21)
const safeToHit = (p, d, c) =>
  noNaturals(p, d) &&
  handTotal(p).total <= 11 &&
  handTotal([...p, drawCard(SERVER_SEED, c, 0, 4)]).total < 21;

test("a deal charges the bet, hides the hole card, and records no roll until settle", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, noNaturals);

  const deal = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  expect(deal.status).toBe(200);
  expect(deal.body.status).toBe("active");
  expect(deal.body.dealer.cards).toHaveLength(1);
  expect(deal.body.dealer.hidden).toBe(true);
  expect(deal.body.hands[0].cards).toHaveLength(2);
  expect(deal.body.rollId).toBeNull();
  expect(JSON.stringify(deal.body)).not.toContain('"dealerCards"');

  expect((await User.findById(u._id)).walletBalance).toBe(900);
  const bet = await Transaction.findOne({ userId: u._id, type: TX.BLACKJACK_BET });
  expect(bet.amount).toBe(100);
  expect(bet.meta.handId).toBe(deal.body.handId);
  expect(await Roll.findOne({ userId: u._id, game: "blackjack" })).toBeNull();

  const stand = await request(app).post("/games/blackjack/stand").set(auth).send({});
  expect(stand.status).toBe(200);
  expect(stand.body.status).toBe("settled");
  expect(stand.body.dealer.hidden).toBe(false);
  expect(stand.body.dealer.cards.length).toBeGreaterThanOrEqual(2);
  expect(stand.body.rollId).toMatch(/^R\d+$/);

  const roll = await Roll.findOne({ userId: u._id, game: "blackjack" });
  expect(roll.outcome.totalPayout).toBe(stand.body.totalPayout);
  expect(roll.outcome.playerHands[0].cards).toEqual(stand.body.hands[0].cards);

  const after = await request(app).get("/games/blackjack/active").set(auth);
  expect(after.body.hand).toBeNull();

  const wallet = (await User.findById(u._id)).walletBalance;
  expect(wallet).toBe(900 + stand.body.totalPayout);
});

test("an insufficient balance answers 400 with no hand and no money moved", async () => {
  const u = await makeUser(50);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const res = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  expect(res.status).toBe(400);
  expect((await User.findById(u._id)).walletBalance).toBe(50);
  expect(await BlackjackHand.findOne({ userId: u._id, status: "active" })).toBeNull();
});

test("bad bets are rejected before any money moves", async () => {
  const u = await makeUser(200000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  for (const betAmount of [0, -5, 1.5, "10", 100001, undefined]) {
    const res = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount });
    expect(res.status).toBe(400);
  }
  expect((await User.findById(u._id)).walletBalance).toBe(200000);
});

test("an active hand blocks a second deal", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, noNaturals);

  expect((await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 10 })).status).toBe(200);
  const second = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 10 });
  expect(second.status).toBe(409);
  expect((await User.findById(u._id)).walletBalance).toBe(990);
});

test("concurrent hits apply exactly once each", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, safeToHit);

  await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 10 });
  const [a, b] = await Promise.all([
    request(app).post("/games/blackjack/hit").set(auth).send({}),
    request(app).post("/games/blackjack/hit").set(auth).send({}),
  ]);
  const successes = [a, b].filter((r) => r.status === 200).length;
  const conflicts = [a, b].filter((r) => r.status === 409).length;
  expect(successes + conflicts).toBe(2);
  expect(successes).toBeGreaterThanOrEqual(1);

  const hand = await BlackjackHand.findOne({ userId: u._id });
  // each success added exactly one card from one cursor; a 409 added nothing
  expect(hand.hands[0].cards).toHaveLength(2 + successes);
  expect(hand.nextCursor).toBe(4 + successes);
});

test("double charges a second bet and settles with the doubled stake", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, noNaturals);

  await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  const res = await request(app).post("/games/blackjack/double").set(auth).send({});
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("settled");
  expect(res.body.hands[0].doubled).toBe(true);
  expect(res.body.hands[0].bet).toBe(200);
  expect(res.body.hands[0].cards).toHaveLength(3);

  const bets = await Transaction.find({ userId: u._id, type: TX.BLACKJACK_BET }).sort({ createdAt: 1 });
  expect(bets).toHaveLength(2);
  expect(bets[1].meta.double).toBe(true);

  const wallet = (await User.findById(u._id)).walletBalance;
  expect(wallet).toBe(1000 - 200 + res.body.totalPayout);
});

test("double without funds answers 400 and leaves the hand playable", async () => {
  const u = await makeUser(100);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, noNaturals);

  await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  const res = await request(app).post("/games/blackjack/double").set(auth).send({});
  expect(res.status).toBe(400);

  const hand = await BlackjackHand.findOne({ userId: u._id });
  expect(hand.status).toBe("active");
  expect(hand.pendingAction).toBeNull();
  expect((await request(app).post("/games/blackjack/stand").set(auth).send({})).status).toBe(200);
});

test("a dealt natural settles immediately at 3:2", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, (p, d) => rankOf(d[0]) !== 0 && isBlackjack(p) && !isBlackjack(d));

  const res = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 101 });
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("settled");
  expect(res.body.hands[0].outcome).toBe("blackjack");
  expect(res.body.totalPayout).toBe(naturalPayout(101));

  const win = await Transaction.findOne({ userId: u._id, type: TX.BLACKJACK_WIN });
  expect(win.amount).toBe(naturalPayout(101));
  expect(win.meta.natural).toBe(true);
  expect((await User.findById(u._id)).weeklyWinnings).toBe(naturalPayout(101));
});

test("both naturals push the stake back with no winnings", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, (p, d) => rankOf(d[0]) !== 0 && isBlackjack(p) && isBlackjack(d));

  const res = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  expect(res.body.status).toBe("settled");
  expect(res.body.hands[0].outcome).toBe("push");

  const push = await Transaction.findOne({ userId: u._id, type: TX.BLACKJACK_PUSH });
  expect(push.amount).toBe(100);
  expect((await User.findById(u._id)).walletBalance).toBe(1000);
  expect((await User.findById(u._id)).weeklyWinnings).toBe(0);
});

test("seed rotation is refused mid-hand and the verifier reproduces the hand after settle", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, safeToHit);

  await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  expect((await request(app).post("/fair/rotate").set(auth).send({})).status).toBe(409);

  await request(app).post("/games/blackjack/hit").set(auth).send({});
  const stand = await request(app).post("/games/blackjack/stand").set(auth).send({});
  expect(stand.status).toBe(200);

  const early = await request(app).get(`/fair/roll/${stand.body.rollId}/verify`);
  expect(early.body.ok).toBe(false);

  expect((await request(app).post("/fair/rotate").set(auth).send({})).status).toBe(200);

  const verified = await request(app).get(`/fair/roll/${stand.body.rollId}/verify`);
  expect(verified.body.ok).toBe(true);
  expect(verified.body.commitmentValid).toBe(true);
  expect(verified.body.recomputedPlayerCards).toEqual([stand.body.hands[0].cards]);
  expect(verified.body.recomputedDealerCards).toEqual(stand.body.dealer.cards);
  expect(verified.body.recomputedPayout).toBe(stand.body.totalPayout);
});

test("the active view never leaks the hole card", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, noNaturals);

  await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 10 });
  const active = await request(app).get("/games/blackjack/active").set(auth);
  expect(active.body.hand.dealer.cards).toHaveLength(1);
  const doc = await BlackjackHand.findOne({ userId: u._id });
  expect(doc.dealerCards).toHaveLength(2);
  // the hidden hole card value must not appear anywhere in the payload
  expect(JSON.stringify(active.body.hand.dealer)).toBe(
    JSON.stringify({ cards: [doc.dealerCards[0]], total: handTotal([doc.dealerCards[0]]).total, hidden: true })
  );
});

test("auto-rotation is deferred while a blackjack hand is live", async () => {
  const u = await makeUser(10000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, noNaturals);

  await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 10 });
  const seed = await Seed.findOne({ userId: u._id, active: true });

  // another game pushes the nonce past the rotation threshold mid-hand
  await Seed.updateOne({ _id: seed._id }, { $set: { nonce: 999 } });
  expect((await request(app).post("/games/plinko").set(auth).send({ betAmount: 10, risk: "low" })).status).toBe(200);
  const during = await Seed.findById(seed._id);
  expect(during.active).toBe(true);

  // once the hand settles, the next reservation performs the deferred rotation
  await request(app).post("/games/blackjack/stand").set(auth).send({});
  expect((await request(app).post("/games/plinko").set(auth).send({ betAmount: 10, risk: "low" })).status).toBe(200);
  expect((await Seed.findById(seed._id)).active).toBe(false);
  expect(await Seed.findOne({ userId: u._id, active: true })).toBeTruthy();
});

// ---- v2: split ----

const splittable = (p, d) =>
  rankOf(d[0]) !== 0 &&
  !isBlackjack(p) &&
  !isBlackjack(d) &&
  rankOf(p[0]) === rankOf(p[1]) &&
  rankOf(p[0]) !== 0 &&
  handTotal(p).total < 21;

test("split charges a second bet and plays two hands to settlement", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, splittable);

  await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  const split = await request(app).post("/games/blackjack/split").set(auth).send({});
  expect(split.status).toBe(200);
  expect(split.body.hands).toHaveLength(2);
  expect(split.body.hands[0].fromSplit).toBe(true);
  expect(split.body.hands[1].bet).toBe(100);

  const bets = await Transaction.find({ userId: u._id, type: TX.BLACKJACK_BET }).sort({ createdAt: 1 });
  expect(bets).toHaveLength(2);
  expect(bets[1].meta.split).toBe(true);

  // stand out whichever hands remain active, then verify the settlement adds up
  let state = split.body;
  let guard = 0;
  while (state.status === "active" && guard++ < 6) {
    const res = await request(app).post("/games/blackjack/stand").set(auth).send({});
    expect(res.status).toBe(200);
    state = res.body;
  }
  expect(state.status).toBe("settled");
  expect(state.hands).toHaveLength(2);
  const perHandSum = state.hands.reduce((s, h) => s + h.payout, 0);
  expect(state.totalPayout).toBe(perHandSum);

  const wallet = (await User.findById(u._id)).walletBalance;
  expect(wallet).toBe(1000 - 200 + state.totalPayout);
});

test("a second split is refused", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, splittable);

  await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 50 });
  const first = await request(app).post("/games/blackjack/split").set(auth).send({});
  if (first.body.status === "active") {
    const again = await request(app).post("/games/blackjack/split").set(auth).send({});
    expect(again.status).toBe(400);
  }
});

// ---- v2: insurance ----

const aceUpDealerNatural = (p, d) =>
  rankOf(d[0]) === 0 && isBlackjack(d) && !isBlackjack(p) && handTotal(p).total < 21;
const aceUpNoNatural = (p, d) =>
  rankOf(d[0]) === 0 && !isBlackjack(d) && !isBlackjack(p) && handTotal(p).total < 21;

test("an ace upcard pauses for insurance and hides the peek", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, aceUpDealerNatural);

  const deal = await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  expect(deal.status).toBe(200);
  expect(deal.body.status).toBe("active");
  expect(deal.body.awaitingInsurance).toBe(true);
  expect(deal.body.canInsure).toBe(true);
  expect(deal.body.canHit).toBe(false);
  expect(deal.body.dealer.cards).toHaveLength(1);

  // no play allowed while the decision is pending
  expect((await request(app).post("/games/blackjack/hit").set(auth).send({})).status).toBe(400);
});

test("accepted insurance pays 2:1 against the dealer natural", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, aceUpDealerNatural);

  await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  const res = await request(app).post("/games/blackjack/insurance").set(auth).send({ accept: true });
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("settled");
  expect(res.body.insuranceBet).toBe(50);
  expect(res.body.hands[0].outcome).toBe("lose");
  expect(res.body.totalPayout).toBe(insurancePayout(50));

  const ins = await Transaction.findOne({ userId: u._id, type: TX.BLACKJACK_BET, "meta.insurance": true });
  expect(ins.amount).toBe(50);
  // bet lost, side bet returned with 2:1: the round nets flat
  expect((await User.findById(u._id)).walletBalance).toBe(1000 - 100 - 50 + 150);
});

test("declined insurance plays on when the dealer has no natural", async () => {
  const u = await makeUser(1000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  await pinSeed(u._id, aceUpNoNatural);

  await request(app).post("/games/blackjack/deal").set(auth).send({ betAmount: 100 });
  const res = await request(app).post("/games/blackjack/insurance").set(auth).send({ accept: false });
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("active");
  expect(res.body.awaitingInsurance).toBe(false);
  expect(res.body.canHit).toBe(true);
  expect(res.body.insuranceBet).toBe(0);

  const stand = await request(app).post("/games/blackjack/stand").set(auth).send({});
  expect(stand.status).toBe(200);
  expect(stand.body.status).toBe("settled");
});
