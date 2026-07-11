const mongoose = require("mongoose");

// provably-fair seed pair for a user. kept in its own collection (never on the
// User doc) so the secret serverSeed can't leak through user serializers.
const SeedSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    serverSeed: { type: String, required: true }, // secret until the seed is rotated
    serverSeedHash: { type: String, required: true }, // public commitment
    clientSeed: { type: String, required: true },
    nonce: { type: Number, default: 0 }, // next nonce to consume
    active: { type: Boolean, default: true },
    revealedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// at most one active seed per user (the partial index leaves revealed seeds free)
SeedSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { active: true } });
SeedSchema.index({ userId: 1, active: 1 });

module.exports = mongoose.model("Seed", SeedSchema);
