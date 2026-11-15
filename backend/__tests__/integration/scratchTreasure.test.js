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
const Notification = require("../../models/Notification");
const ScratchTicket = require("../../models/ScratchTicket");
const seeds = require("../../utils/seeds");
const { TX } = require("../../utils/economy");
const { HOUSE } = require("../../utils/accounts");
const { treasurePayout } = require("../../utils/scratchMath");
const scratch = require("../../games/scratch");

const { sweepScratchTickets, TIMING, STALE_TICKET_MS, UNFUNDED_VOID_MS } = scratch;

// every socket payload is kept, so the test can say none of them carried the board
const pushed = [];
const io = { emit: () => {}, to: (room) => ({ emit: (event, payload) => pushed.push({ room, event, payload }) }) };

let app;

beforeAll(async () => {
  await setupDb();
  await Promise.all([Seed.syncIndexes(), Roll.syncIndexes(), ScratchTicket.syncIndexes()]);
  // the third pick's push waits out the scratch in production; here it goes at once so the test can read it
  TIMING.settlePushMs = 0;
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

async function makeUser(walletBalance = 5000) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
}

const auth = (u) => ({ Authorization: `Bearer ${tokenFor(u)}` });
const buy = (u) => request(app).post("/games/scratch").set(auth(u)).send({ ticket: "treasure", quantity: 1 });
const pick = (u, id, cell) => request(app).post("/games/scratch/pick").set(auth(u)).send({ id, cell });
const active = (u) => request(app).get("/games/scratch/active").set(auth(u));
const DAY_AGO = () => new Date(Date.now() - STALE_TICKET_MS - 60 * 1000);
const LEASE_AGO = () => new Date(Date.now() - 5 * 60 * 1000);

// a response or payload carries a spot's value only for a spot already picked; anything else would be a leak
const assertNoBoard = (body, pickedCells) => {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/"slot"|"row"|"nonce"/);
  if (body && body.board !== undefined) expect(body.board).toBeNull();
  if (body && body.game) {
    expect(body.game.board).toBeNull();
    expect(body.game.picks.map((p) => p.cell).sort()).toEqual([...pickedCells].sort());
  }
  if (body && body.picks) expect(body.picks.map((p) => p.cell).sort()).toEqual([...pickedCells].sort());
};

// backdate past the mongoose timestamps, so a ticket can be made to look abandoned
const backdate = (id, fields) => ScratchTicket.collection.updateOne({ gameId: id }, { $set: fields });

test("buying charges 1,000, opens one active ticket, and shows nothing of its board", async () => {
  const u = await makeUser(5000);

  const res = await buy(u);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ ticket: "treasure", price: 1000, quantity: 1, balanceAfterCharge: 4000, balance: 4000 });
  expect(res.body.game).toMatchObject({ ticket: "treasure", status: "active", picks: [], left: 3, board: null, payout: 0 });
  assertNoBoard(res.body, []);
  expect(res.body.tickets).toBeUndefined();

  const doc = await ScratchTicket.findOne({ userId: u._id }).lean();
  expect(doc).toMatchObject({ status: "active", funded: true, gameId: res.body.game.id, nonce: 0 });
  expect(doc.board).toHaveLength(9);
  expect((await User.findById(u._id)).walletBalance).toBe(4000);
  const bet = await Transaction.findOne({ userId: u._id, type: TX.SCRATCH_BET }).lean();
  expect(bet).toMatchObject({ amount: 1000, direction: "debit", meta: { ticket: "treasure", quantity: 1, price: 1000, gameId: doc.gameId } });
  expect(String(bet.counterparty)).toBe(String(HOUSE));
  expect(await Roll.countDocuments({ userId: u._id })).toBe(0);

  const pushes = pushed.filter((p) => p.event === "userDataUpdated");
  expect(pushes.map((p) => p.payload.walletBalance)).toEqual([4000]);
  for (const p of pushed) assertNoBoard(p.payload, []);

  const resumed = await active(u);
  expect(resumed.body.game).toMatchObject({ id: doc.gameId, picks: [], left: 3, board: null });
});

test("three picks settle the ticket: the sum is credited once, the roll is recorded and the verifier rebuilds it", async () => {
  const u = await makeUser(5000);
  const { id } = (await buy(u)).body.game;
  const { board } = await ScratchTicket.findOne({ gameId: id }).lean();
  // the two best spots and an empty one, so the payout is a real sum
  const ranked = board.map((v, cell) => ({ v, cell })).sort((a, b) => b.v - a.v);
  const cells = [ranked[0].cell, ranked[1].cell, ranked[8].cell];

  const first = await pick(u, id, cells[0]);
  expect(first.status).toBe(200);
  expect(first.body).toMatchObject({ status: "active", cell: cells[0], find: board[cells[0]], left: 2, board: null, payout: 0 });
  assertNoBoard(first.body, [cells[0]]);
  assertNoBoard((await active(u)).body.game, [cells[0]]);

  const second = await pick(u, id, cells[1]);
  expect(second.body).toMatchObject({ status: "active", cell: cells[1], find: board[cells[1]], left: 1, board: null });
  assertNoBoard(second.body, [cells[0], cells[1]]);
  expect(pushed.filter((p) => p.event === "userDataUpdated")).toHaveLength(1);
  for (const p of pushed) assertNoBoard(p.payload, []);

  const third = await pick(u, id, cells[2]);
  const payout = treasurePayout(board, cells);
  expect(third.status).toBe(200);
  expect(third.body).toMatchObject({ status: "settled", left: 0, board, payout, balance: 4000 + payout });
  expect(third.body).not.toHaveProperty("best");
  expect(third.body.picks.map((p) => p.cell)).toEqual(cells);
  expect(third.body.rollId).toMatch(/^R\d+$/);
  expect((await active(u)).body.game).toBeNull();

  expect((await User.findById(u._id)).walletBalance).toBe(4000 + payout);
  const wins = await Transaction.find({ userId: u._id, type: TX.SCRATCH_WIN }).lean();
  expect(wins).toHaveLength(1);
  expect(wins[0]).toMatchObject({ amount: payout, meta: { ticket: "treasure", quantity: 1, price: 1000, betAmount: 1000, payout, gameId: id } });
  const settlePush = pushed.filter((p) => p.event === "userDataUpdated").pop();
  expect(settlePush.payload.walletBalance).toBe(4000 + payout);

  const roll = await Roll.findOne({ rollId: third.body.rollId }).lean();
  expect(roll.outcome).toMatchObject({ ticketId: "treasure", price: 1000, board, picks: cells, payout, auto: false, algoVersion: 1 });

  const early = await request(app).get(`/fair/roll/${roll.rollId}/verify`);
  expect(early.body.ok).toBe(false);
  expect((await request(app).post("/fair/rotate").set(auth(u)).send({})).status).toBe(200);
  const verified = (await request(app).get(`/fair/roll/${roll.rollId}/verify`)).body;
  expect(verified).toMatchObject({ ok: true, commitmentValid: true, recomputedTicket: "treasure", recomputedBoard: board, recomputedPicks: cells, recomputedPayout: payout });

  await Roll.updateOne({ rollId: roll.rollId }, { $set: { "outcome.picks": [cells[0], cells[0], cells[2]] } });
  expect((await request(app).get(`/fair/roll/${roll.rollId}/verify`)).body.ok).toBe(false);
  await Roll.updateOne({ rollId: roll.rollId }, { $set: { "outcome.picks": cells, "outcome.payout": payout + 500 } });
  expect((await request(app).get(`/fair/roll/${roll.rollId}/verify`)).body.ok).toBe(false);
});

test("a spot picked twice answers the same and is never a second pick", async () => {
  const u = await makeUser(5000);
  const { id } = (await buy(u)).body.game;

  const a = await pick(u, id, 4);
  const b = await pick(u, id, 4);
  expect(b.status).toBe(200);
  expect(b.body.find).toBe(a.body.find);
  expect(b.body.left).toBe(2);
  const doc = await ScratchTicket.findOne({ gameId: id }).lean();
  expect(doc.picks).toEqual([4]);
  expect(doc.actionSeq).toBe(1);

  await pick(u, id, 0);
  const last = await pick(u, id, 8);
  const again = await pick(u, id, 8);
  expect(again.status).toBe(200);
  expect(again.body).toMatchObject({ status: "settled", payout: last.body.payout, find: last.body.find, balance: last.body.balance });
  expect(await Transaction.countDocuments({ userId: u._id, type: TX.SCRATCH_WIN })).toBe(last.body.payout > 0 ? 1 : 0);
});

test("three empty spots pay nothing, credit nothing, and still answer with the balance", async () => {
  const u = await makeUser(5000);
  const { id } = (await buy(u)).body.game;
  const { board } = await ScratchTicket.findOne({ gameId: id }).lean();
  // every board has at least four empty spots
  const empties = board.map((v, cell) => (v === 0 ? cell : -1)).filter((cell) => cell >= 0).slice(0, 3);
  for (const cell of empties.slice(0, 2)) await pick(u, id, cell);
  const last = await pick(u, id, empties[2]);
  expect(last.body).toMatchObject({ status: "settled", payout: 0, balance: 4000 });
  expect((await pick(u, id, empties[2])).body.balance).toBe(4000);
  expect(await Transaction.countDocuments({ userId: u._id, type: TX.SCRATCH_WIN })).toBe(0);
  expect((await ScratchTicket.findOne({ gameId: id }).lean()).settlementDone).toBe(true);
  expect(await Roll.countDocuments({ userId: u._id, game: "scratch" })).toBe(1);
});

test("four picks at once never make more than three", async () => {
  const u = await makeUser(5000);
  const { id } = (await buy(u)).body.game;

  const answers = await Promise.all([1, 3, 5, 7].map((cell) => pick(u, id, cell)));
  // a pick that loses the compare-and-set reads the ticket again, so three land and the fourth is told there is no spot left
  expect(answers.map((r) => r.status).sort()).toEqual([200, 200, 200, 409]);

  const doc = await ScratchTicket.findOne({ gameId: id }).lean();
  expect(doc.picks.length).toBeLessThanOrEqual(3);
  expect(new Set(doc.picks).size).toBe(doc.picks.length);
  if (doc.picks.length === 3) {
    expect(doc.status).toBe("settled");
    expect(doc.payout).toBe(treasurePayout(doc.board, doc.picks));
    expect(await Roll.countDocuments({ userId: u._id, game: "scratch" })).toBe(1);
    expect((await User.findById(u._id)).walletBalance).toBe(4000 + doc.payout);
  }
  expect(await Transaction.countDocuments({ userId: u._id, type: TX.SCRATCH_WIN })).toBeLessThanOrEqual(1);

  // whatever the race left, a fourth spot is refused
  for (const cell of [0, 2, 4]) if (!doc.picks.includes(cell) && doc.picks.length < 3) await pick(u, id, cell);
  const settled = await ScratchTicket.findOne({ gameId: id }).lean();
  expect(settled.status).toBe("settled");
  const extra = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((cell) => !settled.picks.includes(cell));
  expect((await pick(u, id, extra)).status).toBe(409);
  expect((await ScratchTicket.findOne({ gameId: id }).lean()).picks).toHaveLength(3);
});

test("a second treasure ticket is refused while one is open, and a stack is not", async () => {
  const u = await makeUser(5000);
  await buy(u);

  const second = await buy(u);
  expect(second.status).toBe(409);
  expect(second.body.message).toMatch(/Borrowed Treasure/);
  expect((await User.findById(u._id)).walletBalance).toBe(4000);
  expect((await Seed.findOne({ userId: u._id, active: true })).nonce).toBe(1);
  expect(await ScratchTicket.countDocuments({ userId: u._id })).toBe(1);

  const stack = await request(app).post("/games/scratch").set(auth(u)).send({ ticket: "pocket", quantity: 3 });
  expect(stack.status).toBe(200);
});

test("bad picks are refused: another player's ticket, a spot off the board, no ticket at all", async () => {
  const u = await makeUser(5000);
  const other = await makeUser(5000);
  const { id } = (await buy(u)).body.game;

  expect((await pick(other, id, 0)).status).toBe(404);
  for (const cell of [-1, 9, 1.5, "1", null]) expect((await pick(u, id, cell)).status).toBe(400);
  expect((await pick(u, "", 0)).status).toBe(400);
  expect((await pick(u, "SC000000000", 0)).status).toBe(404);
  expect((await ScratchTicket.findOne({ gameId: id }).lean()).picks).toEqual([]);
});

test("an empty wallet buys nothing and leaves no open ticket", async () => {
  const u = await makeUser(999);
  const res = await buy(u);
  expect(res.status).toBe(400);
  expect((await User.findById(u._id)).walletBalance).toBe(999);
  expect(await ScratchTicket.countDocuments({ userId: u._id, status: "active" })).toBe(0);
  expect((await active(u)).body.game).toBeNull();
});

test("a ticket left a day is finished from its lowest open spots, paid once, and the player is told", async () => {
  const u = await makeUser(5000);
  const { id } = (await buy(u)).body.game;
  await pick(u, id, 6);
  await backdate(id, { updatedAt: DAY_AGO() });

  await sweepScratchTickets(io);
  const doc = await ScratchTicket.findOne({ gameId: id }).lean();
  expect(doc).toMatchObject({ status: "settled", auto: true, settlementDone: true, picks: [6, 0, 1] });
  expect(doc.payout).toBe(treasurePayout(doc.board, [6, 0, 1]));
  expect(doc.rollId).toMatch(/^R\d+$/);
  const roll = await Roll.findOne({ rollId: doc.rollId }).lean();
  expect(roll.outcome).toMatchObject({ picks: [6, 0, 1], payout: doc.payout, auto: true });

  const wallet = (await User.findById(u._id)).walletBalance;
  expect(wallet).toBe(4000 + doc.payout);
  const note = await Notification.findOne({ receiverId: u._id }).lean();
  expect(note).toMatchObject({ type: "alert", title: "Borrowed Treasure" });
  expect(pushed.some((p) => p.event === "newNotification" && p.room === String(u._id))).toBe(true);

  await sweepScratchTickets(io);
  expect((await User.findById(u._id)).walletBalance).toBe(wallet);
  expect(await Transaction.countDocuments({ userId: u._id, type: TX.SCRATCH_WIN })).toBe(doc.payout > 0 ? 1 : 0);
  expect(await Roll.countDocuments({ userId: u._id })).toBe(1);
  expect(await Notification.countDocuments({ receiverId: u._id })).toBe(1);
});

test("a ticket touched within the day is left alone by the sweep", async () => {
  const u = await makeUser(5000);
  const { id } = (await buy(u)).body.game;
  await backdate(id, { updatedAt: new Date(Date.now() - STALE_TICKET_MS + 60 * 60 * 1000) });
  await sweepScratchTickets(io);
  expect((await ScratchTicket.findOne({ gameId: id }).lean()).status).toBe("active");
});

test("a crash after the third pick settled but before the credit is paid from the ledger, never twice", async () => {
  const u = await makeUser(5000);
  const { id } = (await buy(u)).body.game;
  const { board } = await ScratchTicket.findOne({ gameId: id }).lean();
  const best = board.indexOf(Math.max(...board));
  const picks = [best, ...[0, 1, 2, 3, 4, 5, 6, 7, 8].filter((c) => c !== best).slice(0, 2)];
  const payout = treasurePayout(board, picks);
  await backdate(id, { status: "settled", picks, payout, settledAt: LEASE_AGO(), settlementStartedAt: LEASE_AGO(), settlementDone: false });

  await sweepScratchTickets(io);
  expect((await User.findById(u._id)).walletBalance).toBe(4000 + payout);
  const doc = await ScratchTicket.findOne({ gameId: id }).lean();
  expect(doc.settlementDone).toBe(true);
  expect(doc.rollId).toMatch(/^R\d+$/);

  await sweepScratchTickets(io);
  expect((await User.findById(u._id)).walletBalance).toBe(4000 + payout);
  expect(await Transaction.countDocuments({ userId: u._id, type: TX.SCRATCH_WIN })).toBe(1);
});

test("a credit that landed before the crash is recognised in the ledger and not paid again", async () => {
  const u = await makeUser(5000);
  const { id } = (await buy(u)).body.game;
  await Transaction.create({ userId: u._id, type: TX.SCRATCH_WIN, direction: "credit", amount: 1500, meta: { gameId: id } });
  await backdate(id, { status: "settled", picks: [0, 1, 2], payout: 1500, settlementStartedAt: LEASE_AGO(), settlementDone: false });

  await sweepScratchTickets(io);
  expect((await User.findById(u._id)).walletBalance).toBe(4000);
  expect((await ScratchTicket.findOne({ gameId: id }).lean()).settlementDone).toBe(true);
  expect(await Transaction.countDocuments({ userId: u._id, type: TX.SCRATCH_WIN })).toBe(1);
});

test("an unfunded ticket is voided by the sweep, and one whose charge landed is opened for picks", async () => {
  const u = await makeUser(5000);
  const seed = await seeds.getOrCreateActiveSeed(u._id);
  const base = { userId: u._id, ticket: "treasure", price: 1000, slot: 0, board: [500, 500, 0, 0, 0, 0, 0, 0, 0], seedId: seed._id, clientSeed: seed.clientSeed, serverSeedHash: seed.serverSeedHash, nonce: 0 };
  await ScratchTicket.create({ ...base, gameId: "SC000000001" });
  await backdate("SC000000001", { updatedAt: LEASE_AGO() });

  // five minutes in, its charge may still be retrying, so it is left alone
  await sweepScratchTickets(io);
  expect(await ScratchTicket.findOne({ gameId: "SC000000001" }).lean()).toMatchObject({ status: "active", funded: false });

  await backdate("SC000000001", { updatedAt: new Date(Date.now() - UNFUNDED_VOID_MS - 1000) });
  await sweepScratchTickets(io);
  expect((await ScratchTicket.findOne({ gameId: "SC000000001" }).lean()).status).toBe("voided");
  expect((await User.findById(u._id)).walletBalance).toBe(5000);

  await ScratchTicket.create({ ...base, gameId: "SC000000002", nonce: 1 });
  await Transaction.create({ userId: u._id, type: TX.SCRATCH_BET, direction: "debit", amount: 1000, meta: { ticket: "treasure", gameId: "SC000000002" } });
  await backdate("SC000000002", { updatedAt: LEASE_AGO() });
  expect((await pick(u, "SC000000002", 0)).status).toBe(409);

  await sweepScratchTickets(io);
  expect((await ScratchTicket.findOne({ gameId: "SC000000002" }).lean()).funded).toBe(true);
  expect((await pick(u, "SC000000002", 0)).body).toMatchObject({ cell: 0, find: 500, left: 2 });
});

test("the seed cannot be rotated while a ticket is open", async () => {
  const u = await makeUser(5000);
  const { id } = (await buy(u)).body.game;

  const blocked = await request(app).post("/fair/rotate").set(auth(u)).send({});
  expect(blocked.status).toBe(409);
  expect((await Seed.findOne({ userId: u._id, active: true })).nonce).toBe(1);

  for (const cell of [0, 1, 2]) await pick(u, id, cell);
  expect((await request(app).post("/fair/rotate").set(auth(u)).send({})).status).toBe(200);
});

// the seed rotates at nonce 1000 and rotating reveals it, so a board must never be laid on a seed revealed mid-ticket
test("a purchase that reaches the rotation lays its board on the fresh seed, never the revealed one", async () => {
  const u = await makeUser(5000);
  const first = await seeds.getOrCreateActiveSeed(u._id);
  await Seed.updateOne({ _id: first._id }, { $set: { nonce: 999 } });

  const res = await buy(u);
  expect(res.status).toBe(200);
  expect((await Seed.findById(first._id)).active).toBe(false);
  const live = await ScratchTicket.findOne({ userId: u._id, status: "active" });
  const fresh = await Seed.findOne({ userId: u._id, active: true });
  expect(String(live.seedId)).toBe(String(fresh._id));
  expect(await ScratchTicket.countDocuments({ userId: u._id, status: "voided" })).toBe(1);
  expect(await Transaction.countDocuments({ userId: u._id, type: TX.SCRATCH_BET })).toBe(1);
  expect((await User.findById(u._id)).walletBalance).toBe(4000);
});

test("another game's roll past the rotation waits until the ticket is finished", async () => {
  const u = await makeUser(5000);
  const { id } = (await buy(u)).body.game;
  const doc = await ScratchTicket.findOne({ gameId: id });
  await Seed.updateOne({ _id: doc.seedId }, { $set: { nonce: 999 } });

  expect((await request(app).post("/games/scratch").set(auth(u)).send({ ticket: "pocket", quantity: 3 })).status).toBe(200);
  expect((await Seed.findById(doc.seedId)).active).toBe(true);

  for (const cell of [0, 1, 2]) await pick(u, id, cell);
  expect((await request(app).post("/games/scratch").set(auth(u)).send({ ticket: "pocket", quantity: 1 })).status).toBe(200);
  expect((await Seed.findById(doc.seedId)).active).toBe(false);
});
