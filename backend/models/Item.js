const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    maxlength: 200,
  },
  image: String,
  // the shelf url. minted from the name and never rewritten, so a link keeps working.
  slug: {
    type: String,
  },
  rarity: {
    type: String,
    required: true,
  },
  // the character behind the item, when that is not the item's own name: an alt outfit is
  // its own item but the same person, so both count toward one fan board. absent means the
  // name is the character, which is true of everything but the alt sets.
  character: {
    type: String,
  },
  baseValue: {
    type: Number,
    default: 0,
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Case",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// the cached catalog must not outlive a write. registered here because middleware added
// after a model is compiled never runs, and required lazily so the model carries no
// load-time dependency on the cache that reads it.
const invalidateCatalog = () => require("../utils/itemCatalog").invalidate();
const WRITE_HOOKS = [
  "save",
  "insertMany",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
];
for (const hook of WRITE_HOOKS) ItemSchema.post(hook, invalidateCatalog);

ItemSchema.index({ slug: 1 }, { unique: true, sparse: true }); // url lookup

module.exports = mongoose.model("Item", ItemSchema);
