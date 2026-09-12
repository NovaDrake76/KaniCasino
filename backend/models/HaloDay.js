const mongoose = require("mongoose");

// one row per site day: which student it is and how the day went. the pick is stored rather
// than derived, so a student added to the pool mid-day cannot change the answer.
const HaloDaySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    plays: { type: Number, default: 0 },
    solves: { type: Number, default: 0 },
    // guesses summed over the solves, for the day's average
    guessTotal: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HaloDay", HaloDaySchema);
