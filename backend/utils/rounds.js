const Round = require("../models/Round");
const Transaction = require("../models/Transaction");
const { creditUser, TX } = require("./economy");

const noopIo = { to: () => ({ emit: () => {} }), emit: () => {} };

const TYPES = {
  crash: { bet: TX.CRASH_BET, refund: TX.CRASH_REFUND, paid: TX.CRASH_CASHOUT },
  coinflip: { bet: TX.COINFLIP_BET, refund: TX.COINFLIP_REFUND, paid: TX.COINFLIP_WIN },
};

const emitUserData = (io, userId, user) => {
  if (!user) return;
  io.to(String(userId)).emit("userDataUpdated", {
    walletBalance: user.walletBalance,
    xp: user.xp,
    level: user.level,
  });
};

// who this round already paid or gave back, straight from the ledger. the round doc is
// the wrong place to ask: a restart can land between the credit and the write that
// records it, and paying someone twice is worse than reading one field twice.
async function settledUserIds(roundId, types) {
  const rows = await Transaction.find({
    type: { $in: [types.paid, types.refund] },
    "meta.roundId": String(roundId),
  }).select("userId");
  return new Set(rows.map((t) => String(t.userId)));
}

// give back every stake this round took and never settled. a player who cashed out of
// crash already has their money and is left alone; a player who never got the chance is
// made whole, because a round that did not finish cannot be said to have lost.
async function voidRound(round, io = noopIo) {
  const types = TYPES[round.game];
  const claimed = await Round.findOneAndUpdate(
    { _id: round._id, status: { $in: ["betting", "running"] } },
    { $set: { status: "voided", settledAt: new Date() } },
    { new: true }
  );
  if (!claimed) return null; // another runner got there first

  const settled = await settledUserIds(claimed._id, types);
  const staked = await Transaction.find({
    type: types.bet,
    "meta.roundId": String(claimed._id),
  }).select("userId amount");

  for (const stake of staked) {
    const userId = String(stake.userId);
    if (settled.has(userId)) continue;
    settled.add(userId);
    const user = await creditUser(stake.userId, stake.amount, 0, {
      type: types.refund,
      meta: { roundId: String(claimed._id), reason: "round interrupted" },
    });
    emitUserData(io, userId, user);
  }
  return claimed;
}

// a coin flip that already landed has a real result, so it is finished rather than
// voided: the losers lost fairly and the winners are owed. only the winners the
// interruption beat to the credit are paid.
async function settleInterruptedCoinFlip(round, io = noopIo, payoutFor) {
  const types = TYPES.coinflip;
  const claimed = await Round.findOneAndUpdate(
    { _id: round._id, status: "running" },
    { $set: { status: "settled", settledAt: new Date() } },
    { new: true }
  );
  if (!claimed) return null;

  const winningSide = claimed.outcome && claimed.outcome.winningSide;
  const settled = await settledUserIds(claimed._id, types);

  for (const bet of claimed.bets) {
    if (bet.side !== winningSide) continue;
    const userId = String(bet.userId);
    if (settled.has(userId)) continue;
    settled.add(userId);
    const payout = payoutFor(bet.amount);
    const user = await creditUser(bet.userId, payout, payout - bet.amount, {
      type: types.paid,
      meta: { roundId: String(claimed._id), betAmount: bet.amount, payout, side: winningSide },
    });
    emitUserData(io, userId, user);
  }
  return claimed;
}

// on boot, settle whatever a restart left in flight. a round with no outcome never
// happened and its stakes go back; a coin flip that already landed is finished properly.
async function recoverStuckRounds(io = noopIo, payoutFor) {
  const stuck = await Round.find({ status: { $in: ["betting", "running"] } });
  let voided = 0;
  let settled = 0;

  for (const round of stuck) {
    try {
      const landed = round.game === "coinflip" && round.status === "running" && round.outcome;
      if (landed && typeof payoutFor === "function") {
        if (await settleInterruptedCoinFlip(round, io, payoutFor)) settled += 1;
      } else if (await voidRound(round, io)) {
        voided += 1;
      }
    } catch (e) {
      console.log(e);
    }
  }
  if (voided || settled) {
    console.log(`rounds recovered on boot: ${voided} voided, ${settled} settled`);
  }
  return { voided, settled };
}

module.exports = { voidRound, settleInterruptedCoinFlip, recoverStuckRounds };
