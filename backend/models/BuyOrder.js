const mongoose = require("mongoose");

// a standing offer to buy an item at up to `price` each. funds are ESCROWED when the
// order is placed (charged off the wallet up front), so a match can never fail for
// insufficient balance: every remaining unit is already paid for. `escrow` is the KP
// still held; cancelling refunds exactly that.
const BuyOrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  // snapshot so the order can be listed without populating
  itemName: { type: String },
  itemImage: { type: String },
  rarity: { type: String },
  case: { type: mongoose.Schema.Types.ObjectId, ref: "Case" },
  price: { type: Number, required: true }, // max paid per unit
  quantity: { type: Number, required: true },
  filled: { type: Number, default: 0 },
  escrow: { type: Number, default: 0 }, // KP still held for the unfilled units
  status: { type: String, enum: ["open", "filled", "cancelled"], default: "open" },
  createdAt: { type: Date, default: Date.now },
});

// matching wants the highest bid on an item, oldest first (price-time priority)
BuyOrderSchema.index({ item: 1, status: 1, price: -1, createdAt: 1 });
BuyOrderSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("BuyOrder", BuyOrderSchema);
