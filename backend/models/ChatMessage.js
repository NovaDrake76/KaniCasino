const mongoose = require("mongoose");

// a capped collection: mongo evicts the oldest row itself once the byte cap is reached, so
// this never grows and never needs a prune job. the cap is set at creation only, so a
// collection that already exists uncapped stays that way and has to be converted by hand.
//
// the author card is denormalised onto the row on purpose. a chat renders fifty messages at
// once, and looking their authors up would be fifty user reads per page load on a link that
// carries about 100 KB/s. a stale avatar is worth far more than that.
const ChatMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    username: { type: String, required: true },
    slug: String,
    profilePicture: String,
    level: { type: Number, default: 0 },
    badge: { type: mongoose.Schema.Types.Mixed, default: null },
    text: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { capped: { size: 6 * 1024 * 1024, max: 20000 }, versionKey: false }
);

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
