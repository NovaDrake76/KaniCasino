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

    settled: { type: Boolean, default: false },
    settledAt: Date,
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

module.exports = mongoose.model("PredictionPosition", PredictionPositionSchema);
