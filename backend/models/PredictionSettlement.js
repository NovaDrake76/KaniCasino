const mongoose = require("mongoose");

// the lease and the receipt for one resolution. paying a thousand positions is a loop, and
// a loop that dies halfway must not pay anyone twice when it resumes: this holds the claim
// while it runs and records what it did, the way battleEngine leases a refund loop.
const PredictionSettlementSchema = new mongoose.Schema(
  {
    predictionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prediction",
      required: true,
      unique: true,
    },
    kind: { type: String, enum: ["resolve", "void"], default: "resolve" },
    outcomeKey: String,
    status: {
      type: String,
      enum: ["running", "done", "failed"],
      default: "running",
    },
    lockedAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
    paidPositions: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PredictionSettlement", PredictionSettlementSchema);
