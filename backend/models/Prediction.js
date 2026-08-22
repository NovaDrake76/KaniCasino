const mongoose = require("mongoose");
const { DEFAULT_VIG_BPS, DEFAULT_IMPACT_BPS, openingPrices } = require("../utils/predictionMath");

// an outcome lives on its market rather than in its own collection: they are read
// together, written together in one atomic update, and never queried on their own.
const outcomeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    image: String,
    // integer basis points. 4000 is 0.40 is "40%". never a float; see predictionMath.
    priceBps: { type: Number, required: true },
    // shares of this outcome held by players. this is the house's liability if it comes
    // true, and it is what the exposure cap is measured against: volume counts churn,
    // which is not risk.
    shares: { type: Number, default: 0 },
    volume: { type: Number, default: 0 },
  },
  { _id: false }
);

const PredictionSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    image: String,
    category: { type: String, default: "General" },

    status: {
      type: String,
      enum: ["open", "closed", "resolved", "void"],
      default: "open",
    },
    outcomes: { type: [outcomeSchema], required: true },

    // pinned per market: a market opened at 4% is settled at 4% even if the default moves
    vigBps: { type: Number, default: DEFAULT_VIG_BPS },
    impactBps: { type: Number, default: DEFAULT_IMPACT_BPS },
    // the most the house will let itself owe here, in KP. without it one market can mint
    // more than the whole economy holds.
    exposureCap: { type: Number, default: 100000 },

    endsAt: Date,
    resolvedOutcome: String,
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolutionNote: String,

    volume: { type: Number, default: 0 },
    traders: { type: Number, default: 0 },
    // where this sits on the board. higher floats, and the default of zero means "wherever
    // the usual ordering puts it", so only the markets somebody has an opinion about carry
    // a number.
    boardOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // compare and set token. every price move filters on it and bumps it, so two traders
    // reading the same book cannot both write their answer.
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PredictionSchema.index({ status: 1, endsAt: 1 });
PredictionSchema.index({ category: 1, status: 1 });

// build the opening book for a set of labels
PredictionSchema.statics.openBook = function (labels, vigBps = DEFAULT_VIG_BPS) {
  const prices = openingPrices(labels.length, vigBps);
  return labels.map((label, i) => ({
    key: typeof label === "string" ? `o${i + 1}` : label.key || `o${i + 1}`,
    label: typeof label === "string" ? label : label.label,
    image: typeof label === "string" ? undefined : label.image,
    priceBps: prices[i],
    shares: 0,
    volume: 0,
  }));
};

module.exports = mongoose.model("Prediction", PredictionSchema);
