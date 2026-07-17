const mongoose = require("mongoose");

// one player's stake in a round. payout is what was actually credited, so 0 means the
// bet lost, and null on a voided round means the stake went back instead.
const roundBetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: String,
    amount: { type: Number, required: true },
    side: String, // coin flip: "heads" / "tails"
    multiplier: Number, // crash: what they cashed out at
    payout: { type: Number, default: 0 },
    settledAt: Date,
  },
  { _id: false }
);

// a round of one of the live shared games. crash and coin flip used to keep the whole
// round in a module-local variable while the stakes were already debited in mongo, so
// nothing survived a restart: every in-flight bet was silently kept, and there was no
// record afterwards that the round had ever happened. the other games all write a Roll;
// these two wrote nothing at all.
//
// the status is what makes recovery possible. "betting" means no outcome exists yet,
// "running" means one does and the payouts may be half done, "settled" means the round
// finished normally, and "voided" means a restart caught it in flight and the stakes
// were returned.
const RoundSchema = new mongoose.Schema(
  {
    game: { type: String, enum: ["crash", "coinflip"], required: true },
    status: {
      type: String,
      enum: ["betting", "running", "settled", "voided"],
      default: "betting",
    },
    outcome: mongoose.Schema.Types.Mixed, // { crashPoint } | { result, winningSide }
    // provable fairness: the seed is committed as serverSeedHash before betting and
    // revealed when the round ends; the outcome is derived from it and reproducible.
    serverSeed: String, // revealed at round end
    serverSeedHash: String, // the commitment, public from betting open
    chainId: { type: mongoose.Schema.Types.ObjectId, ref: "GameSeedChain" },
    chainIndex: Number,
    bets: { type: [roundBetSchema], default: [] },
    startedAt: Date,
    settledAt: Date,
    // a give-back loop marks the round when it claims it and again when it finishes, so
    // one that dies partway can be picked up rather than keeping what it still owes
    settlementStartedAt: Date,
    settlementDone: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// the boot recovery sweep
RoundSchema.index({ status: 1 });
// round history, newest first
RoundSchema.index({ game: 1, createdAt: -1 });
// "what did this player bet on, and when"
RoundSchema.index({ "bets.userId": 1, createdAt: -1 });

module.exports = mongoose.model("Round", RoundSchema);
