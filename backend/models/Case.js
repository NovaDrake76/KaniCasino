const mongoose = require("mongoose");

const CaseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  image: String,
  price: {
    type: Number,
    required: true,
  },

  items: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
    },
  ],

  // provably-fair mapping: the committed item ranges for the current config. bumped
  // and archived (see CaseConfig) whenever the case's items/rarities change.
  rollTotal: { type: Number },
  configVersion: { type: Number, default: 0 },
  configHash: { type: String },
  rarityTableVersion: { type: Number },
  rangeTable: [
    {
      _id: false,
      itemId: String,
      rarity: String,
      start: Number,
      end: Number,
    },
  ],
});

module.exports = mongoose.model("Case", CaseSchema);
