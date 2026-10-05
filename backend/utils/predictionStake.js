const mongoose = require("mongoose");
const PredictionPosition = require("../models/PredictionPosition");
const { TX } = require("./economy");

// a prediction counts as a bet once its market resolves, on the stake still held then, so shares bought and sold
// straight back count for nothing. buys made before this date counted when they were made, and still do.
const stakeFrom = () => new Date(process.env.PREDICTION_STAKE_FROM || "2026-10-05T00:00:00Z");

// the ledger's prediction buys from that date on, which are not bets themselves; `field` is the row's time
const laterBuys = (field = "createdAt") => ({ type: TX.PREDICTION_BUY, [field]: { $gte: stakeFrom() } });

// the same rows as an amount, for a $group over a ledger stream that still wants them for anything else
const laterBuyAmount = (field = "$day") => ({
  $sum: { $cond: [{ $and: [{ $eq: ["$type", TX.PREDICTION_BUY] }, { $gte: [field, stakeFrom()] }] }, "$amount", 0] },
});

// settled on a resolution, not refunded by a void, and still holding a stake
const RESOLVED = { settled: true, voided: { $ne: true }, stake: { $gt: 0 } };

// the positions resolved inside `match` as prediction_buy rows, to stand beside the ledger's own bets
const resolvedAsBets = (match) => ({
  $unionWith: {
    coll: PredictionPosition.collection.collectionName,
    pipeline: [
      { $match: { ...match, ...RESOLVED } },
      { $project: { _id: 0, userId: 1, type: { $literal: TX.PREDICTION_BUY }, amount: "$stake" } },
    ],
  },
});

// what one account's positions resolved from `since` on had at stake
async function resolvedSince(userId, since) {
  const [row] = await PredictionPosition.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)), settledAt: { $gte: new Date(since) }, ...RESOLVED } },
    { $group: { _id: null, amount: { $sum: "$stake" } } },
  ]);
  return row ? row.amount : 0;
}

module.exports = { stakeFrom, laterBuys, laterBuyAmount, resolvedAsBets, resolvedSince };
