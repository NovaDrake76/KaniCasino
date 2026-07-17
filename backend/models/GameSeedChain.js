const mongoose = require("mongoose");

// a committed hash chain for a live shared game: the seeds stay secret and are revealed
// one per round, while the terminalHash is the public commitment fixing the sequence.
const GameSeedChainSchema = new mongoose.Schema(
  {
    game: { type: String, enum: ["crash", "coinflip"], required: true },
    terminalHash: { type: String, required: true },
    seeds: { type: [String], required: true }, // secret until each is consumed
    cursor: { type: Number, default: 0 }, // index of the next seed to consume
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// one active chain per game
GameSeedChainSchema.index({ game: 1, active: 1 });

module.exports = mongoose.model("GameSeedChain", GameSeedChainSchema);
