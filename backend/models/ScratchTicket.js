const mongoose = require("mongoose");

// one document per borrowed treasure ticket, so the board committed at purchase and the picks survive restarts; the board
// never leaves the server while it is active, and the serverSeed is not stored here (it resolves through seedId)
const scratchTicketSchema = new mongoose.Schema(
  {
    gameId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ticket: { type: String, required: true },
    price: { type: Number, required: true },
    status: { type: String, enum: ["active", "settled", "voided"], default: "active" },
    // compare-and-set token: every mutation filters on it and bumps it
    actionSeq: { type: Number, default: 0 },
    // set once the charge has landed; a pick on an unfunded ticket is refused, and the sweep settles which it was
    funded: { type: Boolean, default: false },

    // the drawn slot and the nine values under the spots (0 is empty), fixed at purchase from the seed
    slot: { type: Number, required: true },
    board: { type: [Number], required: true },
    // the spots scratched, in the order picked
    picks: { type: [Number], default: [] },

    seedId: { type: mongoose.Schema.Types.ObjectId, ref: "Seed", required: true },
    clientSeed: { type: String, required: true },
    serverSeedHash: { type: String, required: true },
    nonce: { type: Number, required: true },

    payout: { type: Number, default: 0 },
    // finished by the sweep after a day idle rather than by the player's third pick
    auto: { type: Boolean, default: false },
    settledAt: { type: Date, default: null },
    settlementStartedAt: { type: Date, default: null },
    settlementDone: { type: Boolean, default: false },
    rollId: { type: String, default: null },
  },
  { timestamps: true }
);

// at most one active ticket per user
scratchTicketSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: "active" } });
scratchTicketSchema.index({ status: 1, updatedAt: 1 });
// a finished ticket is never read again once it is paid and recorded, so a week after its last touch it expires,
// the same budget the mines boards keep
scratchTicketSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model("ScratchTicket", scratchTicketSchema);
