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

module.exports = { GROWTH, INSTANT_CRASH_CHANCE, multiplierAt, crashPointFromRandom };
