const mongoose = require("mongoose");

// a pending link between a discord account and whichever site account claims the code.
// short-lived by design: mongo expires the row, so nothing here needs sweeping.
const DiscordLinkSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  discordId: { type: String, required: true },
  discordName: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

// mongo drops the row the moment it expires, so a stale code can never be redeemed
DiscordLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// one pending code per discord account, so spamming /link cannot pile up rows
DiscordLinkSchema.index({ discordId: 1 }, { unique: true });

module.exports = mongoose.model("DiscordLink", DiscordLinkSchema);
