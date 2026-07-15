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

module.exports = mongoose.model("Item", ItemSchema);
