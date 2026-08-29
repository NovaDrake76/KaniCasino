const mongoose = require("mongoose");

// one player's finish. points are what the ledger scored them, not a running total kept
// here: the standings are derived, and this is the snapshot taken when the board closed.
const standingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: String,
    rank: { type: Number, required: true },
    points: { type: Number, required: true },
    prize: { type: Number, default: 0 },
    paidAt: Date,
  },
  { _id: false }
);

// a day's leaderboard. the live board is computed from the Transaction ledger rather than stored,
// so nothing has to be incremented on the money path and a bet can never be counted twice.
// this document exists so a finished board is auditable: who placed where, what they were
// paid, and whether the payout run got through everyone.
//
// the settlement discipline is the same as Round: settlementStartedAt is a lease so two
// runners cannot both pay, and settlementDone is written last so a payout loop that dies
// partway is resumed rather than leaving what it still owes.
const LeaderboardSchema = new mongoose.Schema(
  {
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["running", "settled"],
      default: "running",
    },
    standings: { type: [standingSchema], default: [] },
    settledAt: Date,
    settlementStartedAt: Date,
    settlementDone: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// one board per window, so a double-create races itself to a duplicate-key error rather
// than opening two boards for the same day
LeaderboardSchema.index({ startsAt: 1 }, { unique: true });
// the settlement sweep, and the history list
LeaderboardSchema.index({ status: 1, endsAt: 1 });

module.exports = mongoose.model("Leaderboard", LeaderboardSchema);
