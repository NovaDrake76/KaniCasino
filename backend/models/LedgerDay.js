const mongoose = require("mongoose");

// one account's ledger rows of one kind on one utc day, folded into totals so the rows themselves can go.
// only utils/ledgerDays.js writes these; the _id is the group key, so folding a day twice writes the same documents.
const LedgerDaySchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.Mixed },
    day: Date,
    userId: mongoose.Schema.Types.ObjectId,
    type: String,
    direction: String,
    counterparty: mongoose.Schema.Types.ObjectId,
    // the case for a case open, the source for an item sell: the two readers that group finer than the type
    tag: mongoose.Schema.Types.Mixed,
    count: Number,
    amount: Number,
    max: Number,
    qty: Number,
    units: Number,
    base: Number,
    full: Number,
    credit: Number,
    last: Date,
    title: String,
  },
  { versionKey: false }
);

LedgerDaySchema.index({ userId: 1, day: 1 });
LedgerDaySchema.index({ type: 1, day: 1 });
LedgerDaySchema.index({ counterparty: 1 });
LedgerDaySchema.index({ day: 1 });

module.exports = mongoose.model("LedgerDay", LedgerDaySchema);
