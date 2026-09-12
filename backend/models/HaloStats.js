const mongoose = require("mongoose");

// a player's running record, updated once when a game finishes so the page never has to
// read their history to show it
const HaloStatsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    played: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    lastWonDay: { type: Number, default: -1 },
    lastPlayedDay: { type: Number, default: -1 },
    // wins by guess count: index 0 is a first-guess win
    distribution: { type: [Number], default: () => Array(10).fill(0) },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HaloStats", HaloStatsSchema);
