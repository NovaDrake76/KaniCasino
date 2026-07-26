const mongoose = require("mongoose");

// one row per user per campaign. the unique index is what makes a re-run safe: a second
// attempt collides instead of sending twice, so resuming never needs a trustworthy log.
const emailSendSchema = new mongoose.Schema(
  {
    campaign: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true },
    status: { type: String, enum: ["sent", "skipped", "failed"], required: true },
    detail: String,
    sentAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

emailSendSchema.index({ campaign: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("EmailSend", emailSendSchema);
