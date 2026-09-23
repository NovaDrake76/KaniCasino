const mongoose = require("mongoose");

const RETENTION_DAYS = 180;

// one thing a player did with daisu's card, her room, her shop or a page her shop locks, kept to see where the design loses people
const UsageEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    path: String,
    // one per browser tab, so one visit's events can be read in order
    sid: String,
    at: { type: Date, required: true },
  },
  // an event with no params still stores `params: {}`, so every row has the same shape
  { versionKey: false, minimize: false }
);

// the only index: reports read a window of days, and the same index expires the rows the privacy policy promises to drop
UsageEventSchema.index({ at: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model("UsageEvent", UsageEventSchema);
