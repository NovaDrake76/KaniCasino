const mongoose = require("mongoose");

// what happened, not what was intended. fills are instant, so there is no order to be
// pending or cancelled: this is the audit row, and it is what the chart and a player's
// history read from.
const PredictionTradeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    predictionId: { type: mongoose.Schema.Types.ObjectId, ref: "Prediction", required: true },
    outcomeKey: { type: String, required: true },
    action: { type: String, enum: ["buy", "sell"], required: true },

    shares: { type: Number, required: true },
    avgPriceBps: { type: Number, required: true },
    amount: { type: Number, required: true },
    priceBeforeBps: Number,
    priceAfterBps: Number,
  },
  { timestamps: true }
);

PredictionTradeSchema.index({ predictionId: 1, createdAt: -1 });
PredictionTradeSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("PredictionTrade", PredictionTradeSchema);
