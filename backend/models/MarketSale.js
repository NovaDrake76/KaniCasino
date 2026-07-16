const mongoose = require("mongoose");

// a completed marketplace sale. listings are hard-deleted on purchase, so this is
// the only durable record of what an item actually traded for: it is the source of
// truth for price history. never derive history from Item.baseValue, which is
// recomputed from the parent case price and would rewrite the past.
const MarketSaleSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  itemName: { type: String },
  rarity: { type: String },
  price: { type: Number, required: true }, // what the buyer paid
  fee: { type: Number, default: 0 }, // house cut, burned
  sellerNet: { type: Number, default: 0 }, // what the seller received
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  listingId: { type: String },
  viaOrder: { type: Boolean, default: false }, // filled from a resting buy order
  soldAt: { type: Date, default: Date.now },
});

// the only hot query is "this item's sales, newest first, within a window"
MarketSaleSchema.index({ item: 1, soldAt: -1 });
MarketSaleSchema.index({ soldAt: -1 });

module.exports = mongoose.model("MarketSale", MarketSaleSchema);
