const mongoose = require("mongoose");

// per-user mission bookkeeping. progress itself is derived on read from the
// ledger / battles / inventory; only two things must be persisted: which mission
// rewards have been claimed (the one-time-credit guard) and which social links
// the user has clicked (client-reported completion that is not otherwise derivable).
const MissionStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    claimed: { type: [String], default: [] },
    visited: { type: [String], default: [] },
    // missions already announced via the real-time "mission complete" toast, so it
    // fires exactly once. `seeded` marks the one-time catch-up that records existing
    // completions silently (no toast for things finished before real-time tracking).
    announced: { type: [String], default: [] },
    seeded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MissionState", MissionStateSchema);
