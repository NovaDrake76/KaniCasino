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
  rarity: {
    type: String,
    required: true,
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

module.exports = mongoose.model("Item", ItemSchema);
