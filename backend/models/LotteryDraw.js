const mongoose = require("mongoose");

// one daily draw. the seed is committed by its hash while tickets are on sale and only read back once the draw is
// settled; select: false keeps it out of every query that does not ask for it by name
const LotteryDrawSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    drawAt: { type: Date, required: true },
    status: { type: String, enum: ["open", "drawing", "settled"], default: "open" },
    seedHash: { type: String, required: true },
    serverSeed: { type: String, required: true, select: false },
    numbers: { type: [Number], default: undefined },
    // the whole pot, base included; it only moves while the draw is open
    jackpot: { type: Number, required: true },
    tickets: { type: Number, default: 0 },
    winners: {
      m1: { type: Number, default: 0 },
      m2: { type: Number, default: 0 },
      m3: { type: Number, default: 0 },
    },
    jackpotWinners: [{ _id: false, userId: mongoose.Schema.Types.ObjectId, username: String, tickets: Number }],
    jackpotEach: { type: Number, default: 0 },
    // how many draws in a row the jackpot has rolled into this one
    carried: { type: Number, default: 0 },
    drawnAt: Date,
    settledAt: Date,
    // the settlement's lease while it scores and pays
    lockedAt: Date,
  },
  { timestamps: true }
);

LotteryDrawSchema.index({ status: 1, number: -1 });

module.exports = mongoose.model("LotteryDraw", LotteryDrawSchema);
