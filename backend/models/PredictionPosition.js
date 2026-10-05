const mongoose = require("mongoose");

// one row per player per outcome they hold. `settled` is what makes a resumed payout safe:
// it is flipped in the same write that pays, so a settlement that dies halfway cannot pay
// anybody twice when it picks back up.
const PredictionPositionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    predictionId: { type: mongoose.Schema.Types.ObjectId, ref: "Prediction", required: true },
    outcomeKey: { type: String, required: true },

    shares: { type: Number, default: 0 },
    // the cost basis, as shares times the price paid for them. stored rather than the
    // average so a fill is one $inc: recomputing an average needs the old one, and two
    // buys landing together would each recompute from the same stale number.
    costBps: { type: Number, default: 0 },
    // KP actually spent net of sales, which is what a void refunds
    spent: { type: Number, default: 0 },
    // what the position counts for as a bet when its market resolves: buys add, sells take away. xp, leaderboard
    // points and wager missions read it then, so shares bought and sold back count for nothing (utils/predictionStake.js)
    stake: { type: Number, default: 0 },

    settled: { type: Boolean, default: false },
    settledAt: Date,
    // a void refunds the position, so it never counts as a bet
    voided: Boolean,
    payout: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PredictionPositionSchema.virtual("avgPriceBps").get(function () {
  return this.shares > 0 ? Math.round(this.costBps / this.shares) : 0;
});
PredictionPositionSchema.set("toJSON", { virtuals: true });
PredictionPositionSchema.set("toObject", { virtuals: true });

PredictionPositionSchema.index(
  { userId: 1, predictionId: 1, outcomeKey: 1 },
  { unique: true }
);
PredictionPositionSchema.index({ predictionId: 1, settled: 1 });
PredictionPositionSchema.index({ userId: 1, updatedAt: -1 });
// the daily leaderboard reads the positions settled inside its window
PredictionPositionSchema.index({ settledAt: 1 }, { sparse: true });

module.exports = mongoose.model("PredictionPosition", PredictionPositionSchema);
