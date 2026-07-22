const mongoose = require("mongoose");

const playerHandSchema = new mongoose.Schema(
  {
    cards: { type: [Number], required: true },
    bet: { type: Number, required: true },
    doubled: { type: Boolean, default: false },
    fromSplit: { type: Boolean, default: false },
    done: { type: Boolean, default: false },
    outcome: { type: String, enum: ["blackjack", "win", "push", "lose", null], default: null },
    payout: { type: Number, default: 0 },
  },
  { _id: false }
);

// one document per blackjack hand: the first multi-request HTTP game, so the
// in-progress state (and the provably-fair snapshot) must survive restarts.
// the serverSeed is never stored here; draws resolve it through seedId.
const blackjackHandSchema = new mongoose.Schema(
  {
    handId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["active", "settled", "voided"], default: "active" },
    // compare-and-set token: every mutation filters on it and bumps it
    actionSeq: { type: Number, default: 0 },
    // a money-moving action claimed but not yet committed (crash recovery window)
    pendingAction: { type: String, enum: ["double", "split", "insurance", null], default: null },
    pendingAt: { type: Date, default: null },

    betAmount: { type: Number, required: true },
    // an array from day one so split can land later without a migration
    hands: { type: [playerHandSchema], required: true },
    activeHandIndex: { type: Number, default: 0 },
    // [upcard, hole, ...draws]; the hole is never serialized while active
    dealerCards: { type: [Number], required: true },
    // an ace upcard pauses the hand for the insurance decision before the peek
    awaitingInsurance: { type: Boolean, default: false },
    insuranceBet: { type: Number, default: 0 },

    seedId: { type: mongoose.Schema.Types.ObjectId, ref: "Seed", required: true },
    clientSeed: { type: String, required: true },
    serverSeedHash: { type: String, required: true },
    nonce: { type: Number, required: true },
    nextCursor: { type: Number, default: 4 },
    actions: {
      type: [
        new mongoose.Schema(
          { action: String, auto: Boolean, at: Date },
          { _id: false }
        ),
      ],
      default: [],
    },

    dealerTotal: { type: Number, default: null },
    totalPayout: { type: Number, default: 0 },
    // true when any component of the payout is a win (drives the credit type)
    won: { type: Boolean, default: false },
    settledAt: { type: Date, default: null },
    settlementStartedAt: { type: Date, default: null },
    settlementDone: { type: Boolean, default: false },
    rollId: { type: String, default: null },
  },
  { timestamps: true }
);

// at most one active hand per user
blackjackHandSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);
blackjackHandSchema.index({ status: 1, updatedAt: 1 });
blackjackHandSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("BlackjackHand", blackjackHandSchema);
