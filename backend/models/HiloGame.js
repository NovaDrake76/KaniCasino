const mongoose = require("mongoose");

// one document per hilo game: a multi-request HTTP game, so the in-progress state (the
// drawn cards and the running multiplier) must survive restarts. the serverSeed is never
// stored here; cards resolve through seedId and stay secret until the seed rotates.
const hiloGameSchema = new mongoose.Schema(
  {
    gameId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["active", "cashed", "busted", "voided"], default: "active" },
    // compare-and-set token: every mutation filters on it and bumps it
    actionSeq: { type: Number, default: 0 },

    betAmount: { type: Number, required: true },
    // every card drawn so far (indices 0..51); the last one is the current card
    cards: { type: [Number], required: true },
    // one entry per draw after the first: "guess-hi" | "guess-lo" | "skip"
    actions: { type: [String], default: [] },
    multiplier: { type: Number, default: 1 },
    guesses: { type: Number, default: 0 },
    skips: { type: Number, default: 0 },

    seedId: { type: mongoose.Schema.Types.ObjectId, ref: "Seed", required: true },
    clientSeed: { type: String, required: true },
    serverSeedHash: { type: String, required: true },
    nonce: { type: Number, required: true },

    payout: { type: Number, default: 0 },
    settledAt: { type: Date, default: null },
    settlementStartedAt: { type: Date, default: null },
    settlementDone: { type: Boolean, default: false },
    rollId: { type: String, default: null },
  },
  { timestamps: true }
);

// at most one active game per user
hiloGameSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);
hiloGameSchema.index({ status: 1, updatedAt: 1 });
hiloGameSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("HiloGame", hiloGameSchema);
