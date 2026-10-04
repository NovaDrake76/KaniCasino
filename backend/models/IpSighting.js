const mongoose = require("mongoose");

const RETENTION_DAYS = 90;

// an account seen on an address, kept as a keyed hash that cannot be turned back into the ip. it exists so
// staff can see which accounts share a connection when reviewing abuse; the privacy policy promises 90 days.
const IpSightingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ipHash: { type: String, required: true },
    firstAt: { type: Date, required: true },
    lastAt: { type: Date, required: true },
  },
  { versionKey: false }
);

IpSightingSchema.index({ userId: 1, ipHash: 1 }, { unique: true });
IpSightingSchema.index({ ipHash: 1 });
// a sighting not refreshed in 90 days is deleted, which is the retention the policy states
IpSightingSchema.index({ lastAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model("IpSighting", IpSightingSchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
