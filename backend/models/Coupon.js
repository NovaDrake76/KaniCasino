const mongoose = require("mongoose");

// a code that pays a fixed amount once per account, to the first maxRedemptions accounts, until it expires or
// staff switch it off. who took it is kept on the coupon: the cap keeps that list short, and one write both checks and records a redemption
const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 1 },
    maxRedemptions: { type: Number, required: true, min: 1 },
    redeemed: { type: Number, default: 0 },
    redeemedBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    expiresAt: { type: Date, required: true },
    disabledAt: { type: Date, default: null },
    // "discord" for the bot's daily drop, "admin" for one made in the backoffice
    source: { type: String, enum: ["discord", "admin"], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // the drop's place in its day, unique, so two drops racing for the same day cannot both land
    slot: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

CouponSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Coupon", CouponSchema);
