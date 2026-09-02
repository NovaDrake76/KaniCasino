const mongoose = require("mongoose");

const RETENTION_DAYS = 3;

// one audit record per provably-fair draw. holds everything needed to verify the
// outcome later: the seed reference, client seed, nonce, the raw roll, and for case
// rolls the pinned case config version whose immutable range table maps the roll
// to the item. never stores the secret serverSeed (revealed via the Seed doc).
const RollSchema = new mongoose.Schema(
  {
    rollId: { type: String, required: true, unique: true }, // public short id, e.g. R821872881
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    game: { type: String, enum: ["case", "upgrade", "slots", "battle", "plinko", "blackjack", "dice", "mines", "hilo", "gift"], required: true },

    seedId: { type: mongoose.Schema.Types.ObjectId, ref: "Seed", required: true },
    clientSeed: { type: String, required: true },
    serverSeedHash: { type: String, required: true },
    nonce: { type: Number, required: true },
    cursor: { type: Number, default: 0 },
    roll: { type: Number, required: true },
    total: { type: Number, required: true },

    // case-specific outcome + committed mapping
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case" },
    caseConfigVersion: { type: Number },
    caseConfigHash: { type: String },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    uniqueId: { type: String }, // the inventory entry this roll produced

    // free-form outcome for non-case games (upgrade success, slot grid, ...)
    outcome: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

RollSchema.index({ userId: 1, createdAt: -1 });
// the audit trail is kept for thirty days and then expires itself. fairness does not
// live here: the server seed is committed before the bet and revealed after, on the Seed
// and on the Round, so an old draw stays provable to anyone who kept its seed and nonce.
// this row is the convenience lookup, and one nobody has asked for in months of rolls is
// not worth the free tier's whole storage budget.
RollSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model("Roll", RollSchema);
