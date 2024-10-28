const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  image: String,
  rarity: {
    type: String,
    required: true,
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

module.exports = mongoose.model("Item", ItemSchema);
