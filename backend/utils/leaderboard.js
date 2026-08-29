const mongoose = require("mongoose");
const Leaderboard = require("../models/Leaderboard");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { creditUser, TX } = require("./economy");
const { SCORING_TYPES, pointsExpression } = require("./leaderboardPoints");
const { VISIBLE } = require("./visibility");

const noopIo = { to: () => ({ emit: () => {} }), emit: () => {} };

// the leaderboard day turns over at midnight in Brazil, which is 03:00 on a UTC box. players
// think in their own midnight, not the server's.
const RESET_HOUR_UTC = Number(process.env.LEADERBOARD_RESET_HOUR_UTC || 3);

// how many places are paid. paying ten of a field that is usually fifteen to twenty is
// the whole invitation: the top prize matters far less than the odds of winning anything.
const PRIZES = [10000, 5000, 2500, 1200, 900, 700, 500, 400, 300, 200];
const PAID_PLACES = PRIZES.length;

// same lease as round settlement: a payout run that dies holds its claim until this goes
// stale, then another runner picks the board up rather than leaving what it still owes
const SETTLEMENT_LEASE_MS = 120000;

const prizeFor = (rank) => PRIZES[rank - 1] || 0;
const totalPool = PRIZES.reduce((a, b) => a + b, 0);

// the daily window containing `at`. both ends are absolute instants, so a day is exactly
// 24 hours and no row can fall between two of them.
function windowFor(at = new Date()) {
  const startsAt = new Date(at);
  startsAt.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);
  if (startsAt > at) startsAt.setUTCDate(startsAt.getUTCDate() - 1);
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + 1);
  return { startsAt, endsAt };
}

// the board, straight from the ledger. nothing is incremented on the money path, so a
// bet cannot be double counted and there is no stored total to drift. one day is a few
// thousand rows and { type, createdAt } already indexes it.
async function standings(startsAt, endsAt, limit = PAID_PLACES) {
  return Transaction.aggregate([
    { $match: { type: { $in: SCORING_TYPES }, createdAt: { $gte: startsAt, $lt: endsAt } } },
    { $group: { _id: "$userId", points: { $sum: pointsExpression() }, bets: { $sum: 1 } } },
    { $match: { points: { $gt: 0 } } },
    // ties break on the older account, so a redraw never reorders a settled board
    { $sort: { points: -1, _id: 1 } },
    // a buffer, because disabled accounts are dropped below and their places have to fill
    { $limit: limit + 20 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
        // never the inventory: a deep one is two megabytes and this runs per board read
        pipeline: [
          {
            $project: {
              username: 1, slug: 1, profilePicture: 1, level: 1,
              fixedItem: 1, fanRank: 1, selectedBadge: 1, badges: 1, disabled: 1,
            },
          },
        ],
      },
    },
    { $unwind: "$user" },
    // the old weekly cron skipped this and could award a prize to a banned account that
    // the public board did not even list
    { $match: { "user.disabled": VISIBLE.disabled } },
    { $limit: limit },
  ]);
}

// what one player has scored today, and how far they are off the last paid place. read
// separately from the board because they are usually not on it.
async function standingFor(userId, startsAt, endsAt) {
  const id = new mongoose.Types.ObjectId(String(userId));
  const [mine] = await Transaction.aggregate([
    {
      $match: {
        userId: id,
        type: { $in: SCORING_TYPES },
        createdAt: { $gte: startsAt, $lt: endsAt },
      },
    },
    { $group: { _id: null, points: { $sum: pointsExpression() }, bets: { $sum: 1 } } },
  ]);
  if (!mine || mine.points <= 0) return { points: 0, bets: 0, rank: null };

  // rank is a count of who is ahead, which is one grouped pass rather than a full board
  const ahead = await Transaction.aggregate([
    { $match: { type: { $in: SCORING_TYPES }, createdAt: { $gte: startsAt, $lt: endsAt } } },
    { $group: { _id: "$userId", points: { $sum: pointsExpression() } } },
    { $match: { points: { $gt: mine.points } } },
    { $count: "n" },
  ]);

  return { points: mine.points, bets: mine.bets, rank: (ahead[0] ? ahead[0].n : 0) + 1 };
}

// the board document for the window containing `at`, created if this is the first read of
// the day. the unique index on startsAt is what makes a concurrent create safe.
async function ensureToday(at = new Date()) {
  const { startsAt, endsAt } = windowFor(at);
  const existing = await Leaderboard.findOne({ startsAt });
  if (existing) return existing;
  try {
    return await Leaderboard.create({ startsAt, endsAt, status: "running" });
  } catch (err) {
    if (err && err.code === 11000) return Leaderboard.findOne({ startsAt });
    throw err;
  }
}

// who this board already paid, from the ledger rather than the standings array: a runner
// can die between the credit and the write that records it, and paying twice is worse
// than reading twice. the same reasoning as utils/rounds.js.
async function paidUserIds(boardId) {
  const rows = await Transaction.find({
    type: TX.LEADERBOARD_PRIZE,
    "meta.leaderboardId": String(boardId),
  }).select("userId");
  return new Set(rows.map((t) => String(t.userId)));
}

const ordinal = (n) => {
  const suffix = ["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10];
  return `${n}${suffix}`;
};

// pay one placing and tell the player. both steps are keyed so a resumed run repeats
// neither: the credit on its ledger row, the notification on its exact text.
async function payStanding(board, entry, io, alreadyPaid) {
  const userId = String(entry.userId);

  if (!alreadyPaid.has(userId)) {
    const credited = await creditUser(entry.userId, entry.prize, 0, {
      type: TX.LEADERBOARD_PRIZE,
      meta: { leaderboardId: String(board._id), rank: entry.rank, points: entry.points },
    });
    if (!credited) return false; // account is gone, or the write failed; the sweep retries
    alreadyPaid.add(userId);
    io.to(userId).emit("userDataUpdated", {
      walletBalance: credited.walletBalance,
      xp: credited.xp,
      level: credited.level,
    });
  }

  const title = `Daily Leaderboard — ${ordinal(entry.rank)} place`;
  const content =
    `You finished ${ordinal(entry.rank)} with ${entry.points.toLocaleString("en-US")} points. ` +
    `K₽${entry.prize.toLocaleString("en-US")} is in your balance.`;
  const existing = await Notification.findOne({ receiverId: entry.userId, title, content });
  if (!existing) {
    await Notification.create({
      senderId: entry.userId, receiverId: entry.userId, type: "message", title, content,
    });
    io.to(userId).emit("newNotification", { message: content });
  }
  return true;
}

// close one day: snapshot the board, pay the paid places, mark it done. claiming the
// claim sets the lease, and settlementDone is written last, so a run that dies partway is
// resumed by the next sweep instead of keeping what it still owes.
async function settleBoard(board, io = noopIo) {
  const claimed = await Leaderboard.findOneAndUpdate(
    {
      _id: board._id,
      settlementDone: { $ne: true },
      $or: [
        { settlementStartedAt: { $exists: false } },
        { settlementStartedAt: { $lte: new Date(Date.now() - SETTLEMENT_LEASE_MS) } },
      ],
    },
    { $set: { status: "settled", settledAt: new Date(), settlementStartedAt: new Date() } },
    { new: true }
  );
  if (!claimed) return null; // already settled, or another runner holds the lease

  // the board is snapshotted on the first claim only. recomputing it on a resumed run
  // could reorder a board that has already paid someone.
  let entries = claimed.standings;
  if (!entries.length) {
    const board = await standings(claimed.startsAt, claimed.endsAt, PAID_PLACES);
    entries = board.map((row, i) => ({
      userId: row._id,
      username: row.user.username,
      rank: i + 1,
      points: row.points,
      prize: prizeFor(i + 1),
    }));
    if (!entries.length) {
      await Leaderboard.updateOne({ _id: claimed._id }, { $set: { settlementDone: true } });
      return claimed;
    }
    await Leaderboard.updateOne({ _id: claimed._id }, { $set: { standings: entries } });
  }

  const alreadyPaid = await paidUserIds(claimed._id);

  for (const entry of entries) {
    try {
      const paid = await payStanding(claimed, entry, io, alreadyPaid);
      if (paid) {
        await Leaderboard.updateOne(
          { _id: claimed._id, "standings.userId": entry.userId },
          { $set: { "standings.$.paidAt": new Date() } }
        );
      }
    } catch (e) {
      console.error("leaderboard payout failed", String(entry.userId), e);
    }
  }

  await Leaderboard.updateOne({ _id: claimed._id }, { $set: { settlementDone: true } });
  return claimed;
}

// settle every board whose clock has run out, then make sure today's board exists. runs
// on a minute cron and again at boot, so a restart over midnight still pays.
async function sweepBoards(io = noopIo) {
  const due = await Leaderboard.find({
    endsAt: { $lte: new Date() },
    settlementDone: { $ne: true },
  }).limit(10);

  let settled = 0;
  for (const board of due) {
    try {
      if (await settleBoard(board, io)) settled += 1;
    } catch (e) {
      console.error("leaderboard settlement failed", String(board._id), e);
    }
  }
  await ensureToday();
  if (settled) console.log(`leaderboards settled: ${settled}`);
  return settled;
}

module.exports = {
  PRIZES,
  PAID_PLACES,
  totalPool,
  prizeFor,
  windowFor,
  standings,
  standingFor,
  ensureToday,
  settleBoard,
  sweepBoards,
  ordinal,
};
