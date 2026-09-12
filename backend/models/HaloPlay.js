const mongoose = require("mongoose");

// a signed-in player's game for one day. guesses are names in the order they were made; the
// comparison is recomputed from them, so nothing derived is stored.
const HaloPlaySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: Number, required: true },
    guesses: { type: [String], default: [] },
    finished: { type: Boolean, default: false },
    won: { type: Boolean, default: false },
    reward: { type: Number, default: 0 },
    // finished as a guest and carried over at sign-in: it counts for the streak, not for KP
    adopted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

HaloPlaySchema.index({ userId: 1, day: 1 }, { unique: true });

module.exports = mongoose.model("HaloPlay", HaloPlaySchema);
