const mongoose = require("mongoose");

// one ticket: three numbers, sorted. matches and prize are written when its draw is scored
const LotteryTicketSchema = new mongoose.Schema(
  {
    draw: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    numbers: { type: [Number], required: true },
    matches: { type: Number, default: null },
    prize: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// a player's tickets in a draw, and the settlement's scan of a whole draw, which is this index's prefix
LotteryTicketSchema.index({ draw: 1, userId: 1 });
// once its draw is settled only a player's "my tickets in draw #n" reads a ticket, and the draw itself (numbers, winners, seed) is kept
LotteryTicketSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("LotteryTicket", LotteryTicketSchema);
