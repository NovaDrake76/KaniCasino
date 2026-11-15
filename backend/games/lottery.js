const User = require("../models/User");
const LotteryDraw = require("../models/LotteryDraw");
const LotteryTicket = require("../models/LotteryTicket");
const LotteryEntry = require("../models/LotteryEntry");
const { chargeUser, creditUser, runAtomic, TX } = require("../utils/economy");
const { generateServerSeed, hashServerSeed } = require("../utils/provablyFair");
const L = require("../utils/lotteryMath");
const memo = require("../utils/memo");
const verification = require("../utils/verification");
const limits = require("../utils/limits");

// what anyone may see of a draw; the seed is read by name, and only for a settled one
const PUBLIC = "number drawAt status seedHash numbers jackpot tickets winners jackpotWinners jackpotEach carried settledAt";
const PAGE_SIZE = 10;
// every page view asks for the open draw; a purchase and the settlement forget this copy, so it is never staler than a few seconds
const CURRENT_MS = 5000;
const SETTLED_MS = 60 * 1000;

const fail = (status, message, reason) => ({ status, body: { message, reason } });

const openView = (d) =>
  d && {
    number: d.number,
    status: d.status,
    drawAt: d.drawAt,
    salesCloseAt: L.salesCloseAt(d.drawAt),
    jackpot: d.jackpot,
    tickets: d.tickets || 0,
    carried: d.carried || 0,
    seedHash: d.seedHash,
  };

const settledView = (d) =>
  d && {
    number: d.number,
    drawAt: d.drawAt,
    settledAt: d.settledAt,
    numbers: d.numbers,
    jackpot: d.jackpot,
    jackpotEach: d.jackpotEach || 0,
    tickets: d.tickets || 0,
    carried: d.carried || 0,
    winners: { m1: (d.winners && d.winners.m1) || 0, m2: (d.winners && d.winners.m2) || 0, m3: (d.winners && d.winners.m3) || 0 },
    jackpotWinners: (d.jackpotWinners || []).map((w) => ({ userId: String(w.userId), username: w.username, tickets: w.tickets || 1 })),
    seedHash: d.seedHash,
    serverSeed: d.serverSeed,
  };

const ticketView = (t) => ({ numbers: t.numbers, matches: t.matches, prize: t.prize || 0 });

// the draw that is on sale or being drawn right now
const current = () =>
  memo.remember("lottery:current", CURRENT_MS, () =>
    LotteryDraw.findOne({ status: { $in: ["open", "drawing"] } }, PUBLIC).sort({ number: -1 }).lean()
  );

const lastSettled = () =>
  memo.remember("lottery:last", SETTLED_MS, () =>
    LotteryDraw.findOne({ status: "settled" }, PUBLIC).select("+serverSeed").sort({ number: -1 }).lean()
  );

// exactly one draw is open: the unique number is what stops two processes opening the same one. the first draw starts
// at the base; after that a won jackpot starts again at the base and an unwon one carries whole into the next
async function ensureOpenDraw(now = new Date()) {
  const last = await LotteryDraw.findOne({}, PUBLIC).sort({ number: -1 }).lean();
  if (last && last.status !== "settled") return last;
  const won = !!(last && last.winners && last.winners.m3 > 0);
  const serverSeed = generateServerSeed();
  const number = last ? last.number + 1 : 1;
  const after = last ? Math.max(new Date(now).getTime(), new Date(last.drawAt).getTime()) : now;
  try {
    await LotteryDraw.create({
      number,
      drawAt: L.nextDrawAt(after),
      status: "open",
      seedHash: hashServerSeed(serverSeed),
      serverSeed,
      jackpot: !last || won ? L.JACKPOT_BASE : last.jackpot,
      carried: !last || won ? 0 : (last.carried || 0) + 1,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  memo.forget("lottery:");
  return LotteryDraw.findOne({ number }, PUBLIC).lean();
}

// the page: the draw on sale, the last one drawn and, for a signed in player, their tickets in both. one indexed read
// of at most 100 tickets on top of the two cached draws
async function state(user, now = new Date()) {
  let draw = await current();
  if (!draw) draw = await ensureOpenDraw(now);
  const last = await lastSettled();
  const out = { serverTime: now, rules: L.constants(), draw: openView(draw), last: settledView(last), me: null };
  if (!user) return out;

  const numbers = [draw && draw.number, last && last.number].filter((n) => n != null);
  const tickets = numbers.length
    ? await LotteryTicket.find({ draw: { $in: numbers }, userId: user._id }, { draw: 1, numbers: 1, matches: 1, prize: 1 }).sort({ _id: 1 }).lean()
    : [];
  const mine = tickets.filter((t) => draw && t.draw === draw.number);
  const before = tickets.filter((t) => last && t.draw === last.number);
  out.me = {
    tickets: mine.map((t) => ({ numbers: t.numbers })),
    count: mine.length,
    left: Math.max(0, L.CAP - mine.length),
    last: last ? { number: last.number, tickets: before.map(ticketView), won: before.reduce((s, t) => s + (t.prize || 0), 0) } : null,
  };
  return out;
}

// the home page's jackpot and clock, off the same cached read as the page; nothing about the player, so nothing more to read.
// serverTime is when this answer is made, never the cached draw's, so the home countdown runs on the server's clock
async function pot(now = new Date()) {
  const draw = await current();
  return draw ? { number: draw.number, jackpot: draw.jackpot, drawAt: draw.drawAt, serverTime: now } : null;
}

// the cap as one guarded write: two purchases at once cannot both fit under it, and the unique pair settles two first ones
async function claimCap(draw, userId, n) {
  const filter = { draw, userId, count: { $lte: L.CAP - n } };
  const update = { $inc: { count: n } };
  const options = { new: true, projection: { count: 1 } };
  try {
    return await LotteryEntry.findOneAndUpdate(filter, update, { ...options, upsert: true }).lean();
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  return LotteryEntry.findOneAndUpdate(filter, update, options).lean();
}

const releaseCap = (draw, userId, n) =>
  LotteryEntry.updateOne({ draw, userId, count: { $gte: n } }, { $inc: { count: -n } }).catch((err) =>
    console.error("lottery cap release failed", draw, String(userId), err.message)
  );

// thrown when the wallet does not cover the tickets, so the transaction aborts and the pot goes back with it
const UNFUNDED = new Error("lottery tickets not covered by the wallet");

// the pot, the charge and the tickets in one transaction while the draw is open; the pot write is what the settlement's
// switch to drawing serializes against. `wrote` is reset on every run, since a transaction can run this more than once
async function placeTickets(number, userId, picks, cost, wrote) {
  const n = picks.length;
  return runAtomic(async (session) => {
    Object.assign(wrote, { session: Boolean(session), pot: false, charged: null });
    const draw = await LotteryDraw.findOneAndUpdate(
      { number, status: "open" },
      { $inc: { jackpot: L.JACKPOT_SHARE * n, tickets: n } },
      { new: true, session, projection: { number: 1, jackpot: 1, tickets: 1 } }
    ).lean();
    if (!draw) return null;
    wrote.pot = true;
    wrote.charged = await chargeUser(userId, cost, { type: TX.LOTTERY_TICKET, meta: { draw: number, quantity: n }, session });
    if (!wrote.charged) throw UNFUNDED;
    const tickets = await LotteryTicket.insertMany(picks.map((numbers) => ({ draw: number, userId, numbers })), { session });
    return { draw, tickets, user: wrote.charged };
  });
}

// without a transaction each write above committed on its own: the pot goes back, and a charge that landed is refunded.
// undefined when there was nothing to refund, null when the refund failed
async function undoByHand(number, userId, n, cost, wrote) {
  if (wrote.pot) {
    await LotteryDraw.updateOne({ number, status: "open" }, { $inc: { jackpot: -L.JACKPOT_SHARE * n, tickets: -n } }).catch((err) =>
      console.error("lottery pot not put back", number, String(userId), err.message)
    );
  }
  if (!wrote.charged) return undefined;
  return creditUser(userId, cost, 0, { type: TX.LOTTERY_REFUND, meta: { draw: number, quantity: n } });
}

async function buyTickets({ user, picks, io, now = new Date() }) {
  // the market's rule: a limited account, or from the lock date an unverified one, cannot buy
  const locked = limits.lockFor(user) || verification.lockFor(user, now);
  if (locked) return { status: 403, body: locked };

  const sorted = L.normalizePicks(picks);
  if (!sorted) return fail(400, `Every ticket is ${L.PICK} different numbers from 1 to ${L.POOL}, and a purchase is 1 to ${L.CAP} tickets`, "picks");
  const n = sorted.length;

  const draw = await LotteryDraw.findOne({ status: "open" }, { number: 1, drawAt: 1 }).sort({ number: -1 }).lean();
  if (!draw || !L.salesOpen(draw.drawAt, now)) return fail(409, "Sales for this draw are closed", "closed");

  const userId = user._id;
  const claim = await claimCap(draw.number, userId, n);
  if (!claim) return fail(409, `You can hold at most ${L.CAP} tickets in one draw`, "cap");

  const cost = L.PRICE * n;
  const wrote = {};
  let placed;
  try {
    placed = await placeTickets(draw.number, userId, sorted, cost, wrote);
  } catch (err) {
    if (err !== UNFUNDED) console.error("lottery tickets not placed", draw.number, String(userId), err.message);
    // in a transaction nothing was taken, so there is nothing to give back
    const refunded = wrote.session === false ? await undoByHand(draw.number, userId, n, cost, wrote) : undefined;
    await releaseCap(draw.number, userId, n);
    if (refunded === null) {
      console.error("lottery refund failed", draw.number, String(userId), cost);
      return fail(500, "Your tickets could not be placed and the refund failed, contact support", "refund");
    }
    if (refunded) {
      io.to(String(userId)).emit("userDataUpdated", { walletBalance: refunded.walletBalance });
      return fail(503, "Those tickets could not be bought, try again. Your K₽ was returned.", "busy");
    }
    // a null charge is also a write that lost to another; only an empty wallet is the player's fault
    if (err === UNFUNDED && !(await User.exists({ _id: userId, walletBalance: { $gte: cost } }))) return fail(400, "Insufficient balance", "funds");
    return fail(503, "Those tickets could not be bought, try again", "busy");
  }
  if (!placed) {
    // the draw left sales after the check above, and nothing was written
    await releaseCap(draw.number, userId, n);
    return fail(409, "Sales for this draw are closed", "closed");
  }

  const charged = placed.user;
  // joined to the transaction, the charge leaves its referral check to the caller; without one it already ran it
  if (wrote.session) require("../utils/referrals").maybePayReferralMilestone(userId, charged.level, charged).catch(() => {});
  memo.forget("lottery:");
  io.to(String(userId)).emit("userDataUpdated", { walletBalance: charged.walletBalance, xp: charged.xp, level: charged.level });
  io.emit("lottery:pot", { draw: placed.draw.number, jackpot: placed.draw.jackpot, tickets: placed.draw.tickets });

  return {
    status: 200,
    body: {
      tickets: placed.tickets.map((t) => ({ numbers: t.numbers })),
      balance: charged.walletBalance,
      draw: { number: placed.draw.number, jackpot: placed.draw.jackpot, tickets: placed.draw.tickets },
      me: { count: claim.count, left: Math.max(0, L.CAP - claim.count) },
    },
  };
}

// settled draws, newest first, with what a history row and its verification need. the page is held to the real
// last one before it names a cache entry, so a made-up page number cannot push other reads out of the shared cache
async function history(rawPage) {
  const total = await memo.remember("lottery:draws:count", SETTLED_MS, () => LotteryDraw.countDocuments({ status: "settled" }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(parseInt(rawPage, 10) || 1, 1), pages);
  return memo.remember(`lottery:draws:${page}`, SETTLED_MS, async () => {
    const rows = await LotteryDraw.find({ status: "settled" }, PUBLIC)
      .select("+serverSeed")
      .sort({ number: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean();
    return { page, pages, draws: rows.map(settledView) };
  });
}

// a player's own tickets in one draw; the numbers drawn only once it is settled
async function ticketsIn(userId, rawNumber) {
  const number = Number(rawNumber);
  if (!Number.isInteger(number) || number < 1) return fail(400, "No such draw", "draw");
  const [draw, tickets] = await Promise.all([
    LotteryDraw.findOne({ number }, { number: 1, status: 1, numbers: 1 }).lean(),
    LotteryTicket.find({ draw: number, userId }, { numbers: 1, matches: 1, prize: 1 }).sort({ _id: 1 }).lean(),
  ]);
  if (!draw) return fail(404, "No such draw", "draw");
  const settled = draw.status === "settled";
  return {
    status: 200,
    body: {
      number,
      status: draw.status,
      numbers: settled ? draw.numbers : null,
      tickets: tickets.map((t) => (settled ? ticketView(t) : { numbers: t.numbers, matches: null, prize: 0 })),
      won: settled ? tickets.reduce((s, t) => s + (t.prize || 0), 0) : 0,
    },
  };
}

module.exports = { PUBLIC, PAGE_SIZE, ensureOpenDraw, state, pot, buyTickets, claimCap, releaseCap, history, ticketsIn, openView, settledView };
