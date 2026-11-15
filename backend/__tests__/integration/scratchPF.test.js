process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const express = require("express");
const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { tokenFor, uniqueSuffix } = require("./helpers");
const gamesRoutes = require("../../routes/gamesRoutes");
const fairRoutes = require("../../routes/fairRoutes");
const User = require("../../models/User");
const Roll = require("../../models/Roll");
const Seed = require("../../models/Seed");
const Transaction = require("../../models/Transaction");
const { TX } = require("../../utils/economy");
const { HOUSE } = require("../../utils/accounts");
const { gameStats } = require("../../utils/adminStats");
const { LINES, TICKETS } = require("../../utils/scratchMath");

// the socket push is part of the contract here, so the stand-in keeps what it was asked to send
const pushed = [];
const io = { emit: () => {}, to: (room) => ({ emit: (event, payload) => pushed.push({ room, event, payload }) }) };

let app;

beforeAll(async () => {
  await setupDb();
  await Promise.all([Seed.syncIndexes(), Roll.syncIndexes()]);
  app = express();
  app.use(express.json());
  app.use("/games", gamesRoutes(io));
  app.use("/fair", fairRoutes);
});
afterEach(async () => {
  pushed.length = 0;
  await clearDb();
});
afterAll(teardownDb);

async function makeUser(walletBalance = 1000, fields = {}) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance, ...fields });
}

const buy = (u, body) => request(app).post("/games/scratch").set("Authorization", `Bearer ${tokenFor(u)}`).send(body);

const completeLines = (cells) => LINES.filter(([a, b, c]) => cells[a] === cells[b] && cells[b] === cells[c]);
const POCKET_SYMBOLS = TICKETS.pocket.prizes.map(([symbol]) => symbol);

test("one pocket ticket charges its price, settles it, and records one scratch roll", async () => {
  const u = await makeUser(1000);

  const res = await buy(u, { ticket: "pocket", quantity: 1 });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ ticket: "pocket", price: 10, quantity: 1, balanceAfterCharge: 990 });
  const [t] = res.body.tickets;
  expect(t.rollId).toMatch(/^R\d+$/);
  expect(t.cells).toHaveLength(9);
  for (const cell of t.cells) expect(POCKET_SYMBOLS).toContain(cell);
  expect(t.payout).toBe(t.multiplier * 10);
  expect(res.body.totalPayout).toBe(t.payout);
  expect(res.body.balance).toBe(990 + t.payout);

  const roll = await Roll.findOne({ userId: u._id, game: "scratch" }).lean();
  expect(roll.rollId).toBe(t.rollId);
  expect(roll.outcome).toMatchObject({ ticketId: "pocket", price: 10, multiplier: t.multiplier, payout: t.payout, cells: t.cells, line: t.line, algoVersion: 1 });
  expect((await Seed.findOne({ userId: u._id, active: true })).nonce).toBe(1);

  expect((await User.findById(u._id)).walletBalance).toBe(990 + t.payout);
  const bet = await Transaction.findOne({ userId: u._id, type: TX.SCRATCH_BET }).lean();
  expect(bet).toMatchObject({ amount: 10, direction: "debit", meta: { ticket: "pocket", quantity: 1, price: 10 } });
  expect(String(bet.counterparty)).toBe(String(HOUSE));
  const win = await Transaction.findOne({ userId: u._id, type: TX.SCRATCH_WIN }).lean();
  if (t.payout > 0) expect(win).toMatchObject({ amount: t.payout, direction: "credit", meta: { ticket: "pocket", quantity: 1, payout: t.payout } });
  else expect(win).toBeNull();
});

test("one nine ticket shows two lucky symbols, eight spots and a multiplier, and pays what they say", async () => {
  const u = await makeUser(1000);

  const res = await buy(u, { ticket: "nine" });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ ticket: "nine", price: 100, quantity: 1, balanceAfterCharge: 900 });
  const [t] = res.body.tickets;
  expect(t.lucky).toHaveLength(2);
  expect(t.spots).toHaveLength(8);
  const matched = t.spots.filter((s) => t.lucky.includes(s.symbol));
  expect(matched.length).toBe(t.winningSpots.length);
  expect(t.payout).toBe(t.multiplier * matched.reduce((s, spot) => s + spot.prize, 0));
  expect(res.body.balance).toBe(900 + t.payout);

  const roll = await Roll.findOne({ rollId: t.rollId }).lean();
  expect(roll.outcome).toMatchObject({ ticketId: "nine", price: 100, lucky: t.lucky, spots: t.spots, multiplier: t.multiplier, payout: t.payout });
});

test("a stack is one charge and one credit for the whole stack, and one roll per ticket", async () => {
  const u = await makeUser(100000);

  const res = await buy(u, { ticket: "nine", quantity: 10 });
  expect(res.status).toBe(200);
  expect(res.body.tickets).toHaveLength(10);
  expect(res.body.balanceAfterCharge).toBe(100000 - 1000);
  const total = res.body.tickets.reduce((s, t) => s + t.payout, 0);
  expect(res.body.totalPayout).toBe(total);
  expect(res.body.balance).toBe(99000 + total);
  expect((await User.findById(u._id)).walletBalance).toBe(99000 + total);

  const bets = await Transaction.find({ userId: u._id, type: TX.SCRATCH_BET }).lean();
  expect(bets).toHaveLength(1);
  expect(bets[0]).toMatchObject({ amount: 1000, meta: { ticket: "nine", quantity: 10, price: 100 } });
  const wins = await Transaction.find({ userId: u._id, type: TX.SCRATCH_WIN }).lean();
  expect(wins).toHaveLength(total > 0 ? 1 : 0);
  if (total > 0) expect(wins[0].meta).toMatchObject({ betAmount: 1000, payout: total, quantity: 10 });

  const rolls = await Roll.find({ userId: u._id, game: "scratch" }).sort({ nonce: 1 }).lean();
  expect(rolls.map((r) => r.nonce)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(new Set(rolls.map((r) => r.rollId)).size).toBe(10);
  expect(rolls.map((r) => r.rollId).sort()).toEqual(res.body.tickets.map((t) => t.rollId).sort());
  for (const r of rolls) expect(r.outcome).toMatchObject({ stackStart: 0, stackSize: 10 });

  // the backoffice counts tickets, not purchases
  const line = (await gameStats(0)).games.find((g) => g.game === "scratch");
  expect(line).toMatchObject({ plays: 10, wagered: 1000, paidOut: total });
});

test("every pocket ticket in a stack shows one line on a win and none on a loss", async () => {
  const u = await makeUser(1000000);
  const res = await buy(u, { ticket: "pocket", quantity: 10 });
  expect(res.status).toBe(200);
  for (const t of res.body.tickets) {
    const lines = completeLines(t.cells);
    if (t.multiplier) {
      expect(lines).toEqual([t.line]);
      expect(t.cells[t.line[0]]).toBe(t.symbol);
    } else {
      expect(lines).toEqual([]);
      expect(t.winningCells).toEqual([]);
    }
  }
});

test("the socket push carries the balance after the charge, never the winnings", async () => {
  const u = await makeUser(5000);

  const res = await buy(u, { ticket: "nine", quantity: 5 });
  expect(res.status).toBe(200);

  const pushes = pushed.filter((p) => p.event === "userDataUpdated" && p.room === String(u._id));
  expect(pushes).toHaveLength(1);
  expect(pushes[0].payload.walletBalance).toBe(4500);
  expect(pushes[0].payload.walletBalance).toBe(res.body.balanceAfterCharge);
  expect(res.body.balance).toBe(4500 + res.body.totalPayout);
});

test("a stack earns xp on the whole stake, the way every other stake does", async () => {
  const u = await makeUser(1000);
  await buy(u, { ticket: "pocket", quantity: 3 });
  expect((await User.findById(u._id)).xp).toBe(30 * 5);
});

test("a daisu bonus on scratch cards pays for the tickets before the wallet does", async () => {
  const u = await makeUser(1000, { gameCredits: { scratch: 60 }, gameCreditsExpireAt: { scratch: new Date(Date.now() + 300000) } });

  const res = await buy(u, { ticket: "nine", quantity: 1 });
  expect(res.status).toBe(200);
  expect(res.body.balanceAfterCharge).toBe(960);
  const after = await User.findById(u._id).lean();
  expect(after.gameCredits.scratch).toBe(0);
  expect((await Transaction.findOne({ userId: u._id, type: TX.SCRATCH_BET }).lean()).meta.credit).toBe(60);
});

test("an insufficient balance answers 400 and moves no money", async () => {
  const u = await makeUser(250);

  const res = await buy(u, { ticket: "nine", quantity: 3 });
  expect(res.status).toBe(400);
  expect((await User.findById(u._id)).walletBalance).toBe(250);
  expect(await Roll.findOne({ userId: u._id, game: "scratch" })).toBeNull();
  expect(await Transaction.findOne({ userId: u._id })).toBeNull();
});

test("bad tickets and quantities are refused before any money moves", async () => {
  const u = await makeUser(100000);

  const bad = [
    {},
    { ticket: "classic", quantity: 1 },
    { ticket: "gold", quantity: 1 },
    { ticket: "constructor", quantity: 1 },
    { ticket: "Pocket", quantity: 1 },
    { ticket: "nine", quantity: 0 },
    { ticket: "nine", quantity: 11 },
    { ticket: "nine", quantity: 1.5 },
    { ticket: "nine", quantity: "1" },
    { ticket: "nine", quantity: null },
    { ticket: "treasure", quantity: 3 },
    { ticket: "treasure", quantity: 0 },
  ];
  for (const body of bad) {
    const res = await buy(u, body);
    expect({ body, status: res.status }).toEqual({ body, status: 400 });
  }
  expect((await User.findById(u._id)).walletBalance).toBe(100000);
  expect(await Roll.findOne({ userId: u._id, game: "scratch" })).toBeNull();
  expect(await Seed.findOne({ userId: u._id })).toBeNull();
});

test("a missing quantity buys one ticket", async () => {
  const u = await makeUser(1000);
  const res = await buy(u, { ticket: "pocket" });
  expect(res.status).toBe(200);
  expect(res.body.tickets).toHaveLength(1);
  expect(res.body.balanceAfterCharge).toBe(990);
});

test("concurrent stacks reserve distinct nonces", async () => {
  const u = await makeUser(10000);

  const [a, b] = await Promise.all([buy(u, { ticket: "pocket", quantity: 3 }), buy(u, { ticket: "nine", quantity: 2 })]);
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);

  const nonces = (await Roll.find({ userId: u._id, game: "scratch" })).map((r) => r.nonce).sort((x, y) => x - y);
  expect(nonces).toEqual([0, 1, 2, 3, 4]);
});

test("a rotated seed lets the verifier reproduce a pocket grid and a nine board", async () => {
  const u = await makeUser(10000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };

  const pocket = (await buy(u, { ticket: "pocket", quantity: 3 })).body.tickets[1];
  const nine = (await buy(u, { ticket: "nine", quantity: 1 })).body.tickets[0];

  // still hidden: the active seed must not verify
  const early = await request(app).get(`/fair/roll/${pocket.rollId}/verify`);
  expect(early.body.ok).toBe(false);

  await request(app).post("/fair/rotate").set(auth).send({});

  const p = (await request(app).get(`/fair/roll/${pocket.rollId}/verify`)).body;
  expect(p).toMatchObject({ ok: true, commitmentValid: true, recomputedTicket: "pocket" });
  expect(p.recomputedCells).toEqual(pocket.cells);
  expect(p.recomputedWinningCells).toEqual(pocket.winningCells);
  expect(p.recomputedMultiplier).toBe(pocket.multiplier);
  expect(p.recomputedPayout).toBe(pocket.payout);

  const n = (await request(app).get(`/fair/roll/${nine.rollId}/verify`)).body;
  expect(n).toMatchObject({ ok: true, commitmentValid: true, recomputedTicket: "nine" });
  expect(n.recomputedLucky).toEqual(nine.lucky);
  expect(n.recomputedSpots).toEqual(nine.spots);
  expect(n.recomputedWinningSpots).toEqual(nine.winningSpots);
  expect(n.recomputedMultiplier).toBe(nine.multiplier);
  expect(n.recomputedPayout).toBe(nine.payout);
});

test("a tampered roll does not verify", async () => {
  const u = await makeUser(10000);
  const auth = { Authorization: `Bearer ${tokenFor(u)}` };
  const pocket = (await buy(u, { ticket: "pocket", quantity: 1 })).body.tickets[0];
  const nine = (await buy(u, { ticket: "nine", quantity: 1 })).body.tickets[0];
  await request(app).post("/fair/rotate").set(auth).send({});

  const swapped = pocket.cells.map((c, i) => (i === 0 ? (c === "star" ? "crown" : "star") : c));
  await Roll.updateOne({ rollId: pocket.rollId }, { $set: { "outcome.cells": swapped } });
  expect((await request(app).get(`/fair/roll/${pocket.rollId}/verify`)).body.ok).toBe(false);

  await Roll.updateOne({ rollId: nine.rollId }, { $set: { "outcome.multiplier": nine.multiplier === 9 ? 1 : 9 } });
  expect((await request(app).get(`/fair/roll/${nine.rollId}/verify`)).body.ok).toBe(false);
});

test("a burst of purchases on one wallet settles every stack, one after another", async () => {
  const u = await makeUser(1000);

  const answers = await Promise.all(Array.from({ length: 6 }, () => buy(u, { ticket: "pocket", quantity: 2 })));

  expect(answers.map((r) => r.status)).toEqual(Array(6).fill(200));
  expect(await Roll.countDocuments({ userId: u._id, game: "scratch" })).toBe(12);
  const paid = answers.reduce((sum, r) => sum + r.body.totalPayout, 0);
  expect((await User.findById(u._id)).walletBalance).toBe(1000 - 120 + paid);
});
