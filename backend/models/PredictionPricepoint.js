const mongoose = require("mongoose");

// one row per outcome per price move, which is what the chart draws. its own collection
// rather than an array on the market, because it only grows.
const PredictionPricepointSchema = new mongoose.Schema(
  {
    predictionId: { type: mongoose.Schema.Types.ObjectId, ref: "Prediction", required: true },
    outcomeKey: { type: String, required: true },
    priceBps: { type: Number, required: true },
    at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

PredictionPricepointSchema.index({ predictionId: 1, at: 1 });

module.exports = mongoose.model("PredictionPricepoint", PredictionPricepointSchema);
