const mongoose = require("mongoose");

// one document per finished hand. this is the audit trail and the collusion-detection
// substrate at the same time, which is why it stores hole cards even for hands that were
// folded and never shown: a dumped hand looks like a folded hand, and the only way to
// tell them apart later is to have kept the cards.
const handPlayerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: String,
    seat: Number,
    holeCards: { type: [Number], default: [] },
    startStack: Number,
    endStack: Number,
    totalCommitted: Number,
    wonChips: { type: Number, default: 0 },
    folded: { type: Boolean, default: false },
    showed: { type: Boolean, default: false },
    handCategory: { type: Number, default: null },
  },
  { _id: false }
);

const PokerHandSchema = new mongoose.Schema(
  {
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "PokerTable", required: true },
    handNumber: { type: Number, required: true },
    button: Number,
    smallBlind: Number,
    bigBlind: Number,

    players: { type: [handPlayerSchema], default: [] },
    board: { type: [Number], default: [] },
    lastStreet: String,
    sawFlop: { type: Boolean, default: false },
    pots: {
      type: [new mongoose.Schema({ amount: Number, eligible: [Number], winners: [Number] }, { _id: false })],
      default: [],
    },
    rake: { type: Number, default: 0 },

    // items are not moved by a hand; this records what went at risk during it, which is
    // the story the ticker and the lobby tell
    itemsAtRisk: {
      type: [
        new mongoose.Schema(
          { uniqueId: String, name: String, rarity: String, value: Number, userId: mongoose.Schema.Types.ObjectId },
          { _id: false }
        ),
      ],
      default: [],
    },

    // revealed once the hand is over, never before
    pfServerSeed: String,
    pfServerSeedHash: String,
    combinedClientSeed: String,
    algoVersion: Number,

    startedAt: Date,
    endedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PokerHandSchema.index({ tableId: 1, handNumber: -1 });
PokerHandSchema.index({ "players.userId": 1, endedAt: -1 });

module.exports = mongoose.model("PokerHand", PokerHandSchema);
