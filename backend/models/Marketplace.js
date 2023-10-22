const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  id: String,
  name: String,
  image: String,
  rarity: String,
});

const MarketplaceSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    item: {
      type: ItemSchema, // use Item sub-schema
      required: true,
    },
    uniqueId: String,
    price: {
      type: Number,
      required: true,
    },
    itemName: {
      type: String,
      required: true,
    },
    itemImage: {
      type: String,
      required: true,
    },
    rarity: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Marketplace", MarketplaceSchema);
