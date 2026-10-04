const mongoose = require("mongoose");

// a verification link in flight. only the hash of the token is kept, so a leaked collection cannot verify anyone,
// and mongo drops the row when the link expires.
const EmailTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // the address the link proves: the account's own, or the new one a change of email is waiting on
    email: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

EmailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("EmailToken", EmailTokenSchema);
