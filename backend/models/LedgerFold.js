const mongoose = require("mongoose");

// one document: every ledger row with an _id before `through` is folded into LedgerDay, and each
// retention has deleted its rows up to its cursor
const LedgerFoldSchema = new mongoose.Schema(
  {
    _id: String,
    through: Date,
    shortTo: Date,
    longTo: Date,
  },
  { versionKey: false }
);

module.exports = mongoose.model("LedgerFold", LedgerFoldSchema);
