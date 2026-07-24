const mongoose = require("mongoose");

// one document per mines game: a multi-request HTTP game, so the in-progress state
// (and the committed mine layout) must survive restarts. the serverSeed is never
// stored here; it resolves through seedId and stays secret until the seed rotates.
const minesGameSchema = new mongoose.Schema(
  {
    gameId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["active", "cashed", "busted", "voided"], default: "active" },
    // compare-and-set token: every mutation filters on it and bumps it
    actionSeq: { type: Number, default: 0 },

    betAmount: { type: Number, required: true },
    mineCount: { type: Number, required: true },
    // the committed mine positions (0..24), fixed at deal time from the seed
    mineSet: { type: [Number], required: true },
    // tiles the player has revealed, in the order picked
    revealed: { type: [Number], default: [] },

    seedId: { type: mongoose.Schema.Types.ObjectId, ref: "Seed", required: true },
    clientSeed: { type: String, required: true },
    serverSeedHash: { type: String, required: true },
    nonce: { type: Number, required: true },

    multiplier: { type: Number, default: 1 },
    payout: { type: Number, default: 0 },
    // the tile that ended it on a bust, for the reveal animation
    bustTile: { type: Number, default: null },
    settledAt: { type: Date, default: null },
    settlementStartedAt: { type: Date, default: null },
    settlementDone: { type: Boolean, default: false },
    rollId: { type: String, default: null },
  },
  { timestamps: true }
);

// at most one active game per user
minesGameSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);
minesGameSchema.index({ status: 1, updatedAt: 1 });
minesGameSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("MinesGame", minesGameSchema);
