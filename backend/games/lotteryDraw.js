// the daily draw, every step safe to run again after a crash: the numbers are stored with the switch to drawing, the
// scoring is recomputed each time, each player's one payout is claimed in the write that pays it

const User = require("../models/User");
const LotteryDraw = require("../models/LotteryDraw");
const LotteryTicket = require("../models/LotteryTicket");
const LotteryEntry = require("../models/LotteryEntry");
const Notification = require("../models/Notification");
const { creditUser, runAtomic, TX } = require("../utils/economy");
const L = require("../utils/lotteryMath");
const memo = require("../utils/memo");
const { VISIBLE } = require("../utils/visibility");
const lottery = require("./lottery");

// a lease older than this belonged to a run that is not coming back
const LEASE_STALE_MS = 2 * 60 * 1000;
// the page shows the three balls over about five seconds, so balances and toasts wait that long to not spoil them
const REVEAL_MS = 6000;
const CHUNK = 1000;
const FIELDS = "number drawAt status seedHash numbers jackpot tickets carried lockedAt";

const kp = (n) => `${Number(n).toLocaleString("en-US")} K₽`;

const chunks = (list) => {
  const out = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
};

// open to drawing with the numbers in the same write, or take over a draw a dead run left half done
async function takeDraw(latest, now) {
  if (latest.status === "open") {
    if (new Date(latest.drawAt).getTime() > new Date(now).getTime()) return null;
    const numbers = L.drawNumbers(latest.serverSeed, latest.number);
    return LotteryDraw.findOneAndUpdate(
      { number: latest.number, status: "open" },
      { $set: { status: "drawing", numbers, drawnAt: new Date(), lockedAt: new Date() } },
      { new: true, projection: FIELDS }
    ).lean();
  }
  return LotteryDraw.findOneAndUpdate(
    {
      number: latest.number,
      status: "drawing",
      $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(Date.now() - LEASE_STALE_MS) } }],
    },
    { $set: { lockedAt: new Date() } },
    { new: true, projection: FIELDS }
  ).lean();
}

// every ticket's matches and prize, written a tier at a time, then each player's total on their entry. all of it is
// derived from the tickets and the stored numbers, so running it again writes the same values
async function score(draw) {
  const tickets = await LotteryTicket.find({ draw: draw.number }, { userId: 1, numbers: 1 }).lean();
  const tiers = { 0: [], 1: [], 2: [], 3: [] };
  for (const t of tickets) {
    t.matches = L.matchCount(t.numbers, draw.numbers);
    tiers[t.matches].push(t);
  }
  const jackpotEach = L.jackpotShare(draw.jackpot, tiers[3].length);
  const prizeOf = (k) => (k === L.PICK ? jackpotEach : L.fixedPrize(k));
  for (const k of [0, 1, 2, 3]) {
    for (const part of chunks(tiers[k])) {
      await LotteryTicket.updateMany({ _id: { $in: part.map((t) => t._id) } }, { $set: { matches: k, prize: prizeOf(k) } });
    }
  }

  const players = new Map();
  for (const t of tickets) {
    const key = String(t.userId);
    const p = players.get(key) || { userId: t.userId, tickets: 0, prize: 0, matched: { m1: 0, m2: 0, m3: 0 }, jackpotPrize: 0 };
    p.tickets += 1;
    p.prize += prizeOf(t.matches);
    if (t.matches > 0) p.matched[`m${t.matches}`] += 1;
    if (t.matches === L.PICK) p.jackpotPrize += jackpotEach;
    players.set(key, p);
  }
  const winners = [...players.values()].filter((p) => p.prize > 0);
  for (const part of chunks(winners)) {
    await LotteryEntry.bulkWrite(
      part.map((p) => ({
        updateOne: {
          filter: { draw: draw.number, userId: p.userId },
          update: { $set: { tickets: p.tickets, prize: p.prize, matched: p.matched, jackpotPrize: p.jackpotPrize } },
          upsert: true,
        },
      }))
    );
  }

  const hit = [...players.values()].filter((p) => p.matched.m3 > 0);
  // a disabled account still wins, but it is not named in public
  const names = hit.length ? await User.find({ _id: { $in: hit.map((p) => p.userId) }, ...VISIBLE }, { username: 1 }).lean() : [];
  const nameOf = new Map(names.map((u) => [String(u._id), u.username]));
  const jackpotWinners = hit.map((p) => ({ userId: p.userId, username: nameOf.get(String(p.userId)) || "player", tickets: p.matched.m3 }));
  const winnerCounts = { m1: tiers[1].length, m2: tiers[2].length, m3: tiers[3].length };
  await LotteryDraw.updateOne({ number: draw.number, status: "drawing" }, { $set: { winners: winnerCounts, jackpotEach, jackpotWinners } });
  return { winners: winnerCounts, jackpotEach, jackpotWinners };
}

const winLine = (entry, draw) =>
  entry.jackpotPrize > 0
    ? `You hit the jackpot in lottery draw #${draw.number}! You won ${kp(entry.prize)}.`
    : `You won ${kp(entry.prize)} in lottery draw #${draw.number}.`;

// one credit for everything a player won in the draw, claimed in the same transaction that pays it. without
// transactions it is the prediction payout's shape: claim, credit, and hand the claim back if the credit fails
async function payEntry(entry, draw) {
  const meta = {
    draw: draw.number,
    tickets: entry.tickets,
    matched: { 1: entry.matched.m1 || 0, 2: entry.matched.m2 || 0, 3: entry.matched.m3 || 0 },
    jackpot: entry.jackpotPrize || 0,
  };
  const paid = await runAtomic(async (session) => {
    const claimed = await LotteryEntry.findOneAndUpdate(
      { _id: entry._id, paid: { $ne: true } },
      { $set: { paid: true, paidAt: new Date() } },
      { new: true, session, projection: { _id: 1 } }
    ).lean();
    if (!claimed) return null;
    const credited = await creditUser(entry.userId, entry.prize, entry.prize, { type: TX.LOTTERY_WIN, meta, session });
    if (credited) return credited;
    // nobody left to pay: the claim stands, or a missing account would hold every later draw back
    if (!(await User.exists({ _id: entry.userId }))) {
      console.error("lottery payout to a missing account", draw.number, String(entry.userId), entry.prize);
      return { missing: true };
    }
    if (!session) await LotteryEntry.updateOne({ _id: entry._id }, { $set: { paid: false }, $unset: { paidAt: 1 } });
    throw new Error("lottery payout could not be credited");
  });
  if (!paid || paid.missing) return null;
  // best effort and after the money: a lost notification costs nothing a balance check cannot show
  await Notification.create({ receiverId: entry.userId, type: "alert", title: "Lottery", content: winLine(entry, draw) }).catch((err) =>
    console.error("lottery notification failed", draw.number, String(entry.userId), err.message)
  );
  return paid;
}

// the winners' balances once the balls are out, read fresh so a bet placed meanwhile is not overwritten by an older figure
async function tellPlayers(io, draw, paid) {
  if (!io || !paid.length) return;
  const fresh = await User.find({ _id: { $in: paid.map((p) => p.entry.userId) } }, { walletBalance: 1, xp: 1, level: 1 }).lean();
  const byId = new Map(fresh.map((u) => [String(u._id), u]));
  for (const { entry } of paid) {
    const id = String(entry.userId);
    io.to(id).emit("newNotification", { message: winLine(entry, draw) });
    const user = byId.get(id);
    if (user) io.to(id).emit("userDataUpdated", { walletBalance: user.walletBalance, xp: user.xp, level: user.level });
  }
}

// the cron at 20:00, the boot sweep and the five-minute sweep all call this. each run reads the newest draw; only when
// one is due does it read that draw's tickets (at most 50 a player, a few hundred small documents) and its winners' entries
async function settleDue(io, { now = new Date(), revealMs = REVEAL_MS } = {}) {
  const latest = await LotteryDraw.findOne({}, FIELDS).select("+serverSeed").sort({ number: -1 }).lean();
  if (!latest || latest.status === "settled") {
    await lottery.ensureOpenDraw(now);
    return null;
  }
  const draw = await takeDraw(latest, now);
  if (!draw) return null;

  let result;
  const paid = [];
  try {
    result = await score(draw);
    const owed = await LotteryEntry.find({ draw: draw.number, prize: { $gt: 0 }, paid: { $ne: true } }).lean();
    for (const [i, entry] of owed.entries()) {
      const user = await payEntry(entry, draw);
      if (user) paid.push({ entry, user });
      // the lease is held for as long as the loop is making progress
      if ((i + 1) % 25 === 0) await LotteryDraw.updateOne({ number: draw.number, status: "drawing" }, { $set: { lockedAt: new Date() } });
    }
    const settled = await LotteryDraw.findOneAndUpdate(
      { number: draw.number, status: "drawing" },
      { $set: { status: "settled", settledAt: new Date() }, $unset: { lockedAt: 1 } },
      { new: true }
    ).lean();
    if (!settled) throw new Error("the draw left the drawing state under the settlement");
  } catch (err) {
    console.error("lottery settlement failed, it will be retried", draw.number, err.message);
    await LotteryDraw.updateOne({ number: draw.number, status: "drawing" }, { $unset: { lockedAt: 1 } }).catch(() => {});
    memo.forget("lottery:");
    return { error: err.message, number: draw.number, paid: paid.length };
  }

  memo.forget("lottery:");
  const next = await lottery.ensureOpenDraw(now);
  if (io) {
    io.emit("lottery:drawn", {
      number: draw.number,
      numbers: draw.numbers,
      jackpot: draw.jackpot,
      jackpotEach: result.jackpotEach,
      winners: result.winners,
      jackpotWinners: result.jackpotWinners.map((w) => ({ userId: String(w.userId), username: w.username, tickets: w.tickets })),
      next: next && lottery.openView(next),
    });
    const tell = () => tellPlayers(io, draw, paid).catch((err) => console.error("lottery pushes failed", draw.number, err.message));
    if (revealMs > 0) setTimeout(tell, revealMs).unref();
    else await tell();
  }
  return {
    number: draw.number,
    numbers: draw.numbers,
    jackpot: draw.jackpot,
    ...result,
    paid: paid.length,
    totalPaid: paid.reduce((s, p) => s + p.entry.prize, 0),
    next: next && next.number,
  };
}

module.exports = { settleDue, LEASE_STALE_MS, REVEAL_MS };
