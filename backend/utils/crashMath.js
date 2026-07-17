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

// the outcome derived from one seed so the round is verifiable: two disjoint words of
// sha256(seed) drive the instant bust and the curve, matching the old random distribution.
const crashPointFromSeed = (serverSeed) => {
  const hash = crypto.createHash("sha256").update(serverSeed).digest("hex");
  const bust = parseInt(hash.slice(0, 8), 16) / 2 ** 32; // uniform [0,1)
  if (bust < INSTANT_CRASH_CHANCE) return 1.0;
  return crashPointFromRandom(parseInt(hash.slice(8, 16), 16));
};

module.exports = { GROWTH, INSTANT_CRASH_CHANCE, multiplierAt, crashPointFromRandom, crashPointFromSeed };
