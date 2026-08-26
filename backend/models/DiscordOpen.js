const mongoose = require("mongoose");

// one row per opening the bot has already run, keyed by the discord interaction that
// asked for it.
//
// discord does not retry a gateway interaction the way it retries a webhook, but a
// session resume replays whatever the bot missed while it was disconnected. That is a
// narrow window in which one /open could arrive twice and charge twice, which is not a
// thing to leave to luck on a money path.
//
// nothing but the id is kept. a replayed interaction is already past its three second
// reply window, so there is nothing to render and nothing worth storing to render it.
const DiscordOpenSchema = new mongoose.Schema({
  interactionId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

// long enough to cover any resume worth worrying about, short enough to cost nothing
DiscordOpenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model("DiscordOpen", DiscordOpenSchema);
