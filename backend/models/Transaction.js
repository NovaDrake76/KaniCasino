const mongoose = require("mongoose");

// an append-only record of every walletBalance change. `amount` is the positive
// magnitude and `direction` gives the sign; `balanceAfter` snapshots the wallet
// right after the change so history can be reconciled without replaying the ledger.
const TransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
  },
  direction: {
    type: String,
    enum: ["credit", "debit"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  balanceAfter: {
    type: Number,
  },
  // the account on the other side of the movement (a user or a system account), so a
  // row is a complete double entry and every account's balance is derivable
  counterparty: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    sparse: true,
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

TransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
