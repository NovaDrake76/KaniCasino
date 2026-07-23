const crypto = require("crypto");

const GROWTH = 0.06; // multiplier growth per second
const INSTANT_CRASH_CHANCE = 0.03;

// multiplier grows exponentially with time, capped at the crash point
const multiplierAt = (elapsedSeconds, crashPoint) =>
  Math.min(Math.exp(elapsedSeconds * GROWTH), crashPoint);

// crash point derived from a 32-bit random integer (provably-fair style)
const crashPointFromRandom = (h) => {
  const e = 2 ** 32;
  return Math.floor((100 * e - h) / (e - h)) / 100;
};

// the outcome is derived by an hmac KEYED with the seed, not by sha256(seed): the round's
// published commitment is sha256(seed), so deriving the outcome from that same hash let
// anyone read the crash point off the commitment before betting closed. hmac(seed, "crash")
// needs the still-secret seed, so it stays unknowable until reveal while sha256(seed) still
// verifies the chain link. two disjoint words drive the instant bust and the curve.
const crashPointFromSeed = (serverSeed) => {
  const hash = crypto.createHmac("sha256", serverSeed).update("crash").digest("hex");
  const bust = parseInt(hash.slice(0, 8), 16) / 2 ** 32; // uniform [0,1)
  if (bust < INSTANT_CRASH_CHANCE) return 1.0;
  return crashPointFromRandom(parseInt(hash.slice(8, 16), 16));
};

// an auto-cashout target off the wire: cents precision, 1.01x..10000x; null = invalid
const normalizeAutoCashout = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  if (rounded < 1.01 || rounded > 10000) return null;
  return rounded;
};

module.exports = { GROWTH, INSTANT_CRASH_CHANCE, multiplierAt, crashPointFromRandom, crashPointFromSeed, normalizeAutoCashout };
