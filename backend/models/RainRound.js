const mongoose = require("mongoose");

// one row per half hour, so about 48 a day. the pool is not stored as a running total: it
// is derived from the ledger for the window, the same way the daily board is, so nothing
// on the betting path has to be changed to feed it.
const RainRoundSchema = new mongoose.Schema(
  {
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true, index: true },
    // who is in. bounded by the people online in half an hour, so tens rather than thousands
    joiners: [{ type: mongoose.Schema.Types.ObjectId }],
    // what a round that paid nobody leaves behind for the next one
    carriedIn: { type: Number, default: 0 },
    settledAt: Date,
    pool: Number,
    // what the shares actually took. the difference from pool is what the per-player cap
    // and the dust floor refused, and it is what rides into the next round.
    paidOut: Number,
  },
  { versionKey: false }
);

module.exports = mongoose.model("RainRound", RainRoundSchema);
