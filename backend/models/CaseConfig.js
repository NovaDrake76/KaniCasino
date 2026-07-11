const mongoose = require("mongoose");

// an immutable snapshot of a case's provably-fair mapping at a given version. a new
// version is written whenever the case's items/rarities change; rolls pin a
// (caseId, configVersion) so their outcome stays verifiable even after later edits.
const CaseConfigSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true },
    configVersion: { type: Number, required: true },
    configHash: { type: String, required: true },
    rollTotal: { type: Number, required: true },
    rarityTableVersion: { type: Number, required: true },
    rangeTable: [
      {
        _id: false,
        itemId: String,
        rarity: String,
        start: Number,
        end: Number,
      },
    ],
  },
  { timestamps: true }
);

CaseConfigSchema.index({ caseId: 1, configVersion: 1 }, { unique: true });

module.exports = mongoose.model("CaseConfig", CaseConfigSchema);
