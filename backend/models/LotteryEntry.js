const mongoose = require("mongoose");

// one player in one draw: the ticket count that holds the cap, and once the draw is scored the one payout it owes.
// `paid` is flipped in the same write that pays, so a settlement that resumes cannot pay a player twice
const LotteryEntrySchema = new mongoose.Schema(
  {
    draw: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    count: { type: Number, default: 0 },
    tickets: { type: Number, default: 0 },
    prize: { type: Number, default: 0 },
    matched: {
      m1: { type: Number, default: 0 },
      m2: { type: Number, default: 0 },
      m3: { type: Number, default: 0 },
    },
    jackpotPrize: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
    paidAt: Date,
  },
  { timestamps: true }
);

// the unique pair is what settles two first purchases racing for one player's entry
LotteryEntrySchema.index({ draw: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("LotteryEntry", LotteryEntrySchema);
