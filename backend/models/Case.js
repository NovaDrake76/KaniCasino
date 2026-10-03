const mongoose = require("mongoose");

const CaseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  image: String,
  // the shelf url. minted from the title and never rewritten, so a link keeps working.
  slug: {
    type: String,
  },
  price: {
    type: Number,
    required: true,
  },
  // homepage section label ("Touhou", "Animals"); empty falls into the other group
  category: {
    type: String,
    default: "",
  },
  // whether the case counts toward its category's collection badge. premium cases are
  // alt outfits and joke items rather than new faces, so they are the shelf's top end
  // without being part of the roster you are asked to complete. the case keeps its own
  // sticker album either way. set explicitly, never derived from price: price moves.
  collectible: {
    type: Boolean,
    default: true,
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

// the copies of the public case reads, and the collection sets the badges use, must not outlive a write; registered before the model compiles, or the hooks never run
const forgetCases = () => {
  require("../utils/memo").forget("cases:");
  require("../utils/badges").invalidateCollectionSets();
};
for (const hook of ["save", "insertMany", "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace", "updateOne", "updateMany", "deleteOne", "deleteMany"]) {
  CaseSchema.post(hook, forgetCases);
}

CaseSchema.index({ slug: 1 }, { unique: true, sparse: true }); // url lookup

module.exports = mongoose.model("Case", CaseSchema);
