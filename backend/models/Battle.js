const mongoose = require("mongoose");

// an item snapshot won in a battle (mirrors an inventory entry)
const battleItemSchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    image: String,
    rarity: String,
    case: mongoose.Schema.Types.ObjectId,
    baseValue: Number,
    uniqueId: String,
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // null for bots
    username: String,
    profilePicture: String,
    team: Number,
    slot: Number,
    isBot: { type: Boolean, default: false },
    items: { type: [battleItemSchema], default: [] },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const BattleSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["waiting", "in_progress", "finished", "cancelled"],
      default: "waiting",
    },
    mode: { type: String, required: true },
    bakaMode: { type: Boolean, default: false },
    cases: [{ type: mongoose.Schema.Types.ObjectId, ref: "Case" }], // ordered, repeats allowed
    entryCost: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    players: { type: [playerSchema], default: [] },
    rolls: { type: Array, default: [] }, // rolls[caseIndex][slot] = item snapshot
    currentRound: { type: Number, default: 0 },
    winnerUserIds: [{ type: mongoose.Schema.Types.ObjectId }],
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Battle", BattleSchema);
