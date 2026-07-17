const mongoose = require("mongoose");

// one issued watch-token per rewarded ad view; claimed once, then kept only long
// enough to count against the day before the ttl sweeps it
const AdWatchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  claimedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24, // a day covers the daily cap window, then self-cleans
  },
});

module.exports = mongoose.model("AdWatch", AdWatchSchema);
