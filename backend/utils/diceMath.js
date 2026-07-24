// pure dice math: one roll maps a provably-fair float to a 0.00-99.99 result, and a
// (target, direction) win condition prices the payout. the game controller and the
// verifier both fold through this, so they can never disagree.
const DICE_ALGO_VERSION = 1;

// 10000 equally likely outcomes 0..9999, displayed as result/100 (0.00..99.99)
const OUTCOMES = 10000;

// win chance is capped 2%..98%, so the multiplier tops out at 49.50x (the Stake cap)
const MIN_WIN_COUNT = 200;
const MAX_WIN_COUNT = 9800;

const MIN_BET = 1;
// keeps the max payout at 990,000 (MAX_BET * 49.5x), in line with the other games
const MAX_BET = 20000;

// 99% RTP: multiplier = 0.99 / winChance = 0.99 * OUTCOMES / winCount. kept as
// 4-decimal fixed point (multiplier * MULT_SCALE) so the payout is exact integer
// arithmetic, never a float. numerator = 0.99 * OUTCOMES * MULT_SCALE.
const MULT_SCALE = 10000;
const RTP_NUMERATOR = (99 * OUTCOMES * MULT_SCALE) / 100; // = 99,000,000

const isDirection = (d) => d === "over" || d === "under";

// the integer result in [0, 9999] for a single provably-fair float
function resultFromFloat(float) {
  return Math.floor(float * OUTCOMES);
}

// winning outcomes for a threshold: under wins below it, over wins at or above it,
// so the two directions are exactly complementary and every chance is exact
function winCountFor(target, direction) {
  return direction === "under" ? target : OUTCOMES - target;
}

function isWin(result, target, direction) {
  return direction === "under" ? result < target : result >= target;
}

// multiplier as 4-decimal fixed point (multiplier * MULT_SCALE); 4950 winning outcomes -> 20000 (2.0000x)
function multiplierBP(winCount) {
  return Math.round(RTP_NUMERATOR / winCount);
}

function multiplierFor(winCount) {
  return multiplierBP(winCount) / MULT_SCALE;
}

// win chance as a percent (winCount 4950 -> 49.5)
function winChanceFor(winCount) {
  return (winCount / OUTCOMES) * 100;
}

// payout in whole cents; integer bet times integer fixed-point multiplier, so exact.
// dividing the 4-decimal multiplier by (MULT_SCALE/100) lands on 2-decimal cents.
function payoutCentsFor(betAmount, winCount, won) {
  return won ? Math.floor((betAmount * multiplierBP(winCount)) / (MULT_SCALE / 100)) : 0;
}

// a target off the wire: integer 0.01 units, and the winCount it implies must sit in
// the 2%..98% band. returns null on anything invalid.
function normalizeTarget(target, direction) {
  if (!isDirection(direction)) return null;
  if (!Number.isInteger(target) || target < 1 || target > OUTCOMES - 1) return null;
  const winCount = winCountFor(target, direction);
  if (winCount < MIN_WIN_COUNT || winCount > MAX_WIN_COUNT) return null;
  return target;
}

function validBet(betAmount) {
  return Number.isInteger(betAmount) && betAmount >= MIN_BET && betAmount <= MAX_BET;
}

// resolve a whole bet from its float; the single source both the game and verifier use
function resolveRoll(float, betAmount, target, direction) {
  const result = resultFromFloat(float);
  const winCount = winCountFor(target, direction);
  const won = isWin(result, target, direction);
  const payoutCents = payoutCentsFor(betAmount, winCount, won);
  return {
    result, // 0..9999
    resultValue: result / 100, // 0.00..99.99, for display
    target,
    direction,
    winCount,
    winChance: winChanceFor(winCount),
    multiplier: multiplierFor(winCount),
    won,
    payout: payoutCents / 100,
  };
}

module.exports = {
  DICE_ALGO_VERSION,
  OUTCOMES,
  MIN_WIN_COUNT,
  MAX_WIN_COUNT,
  MIN_BET,
  MAX_BET,
  resultFromFloat,
  winCountFor,
  isWin,
  multiplierBP,
  multiplierFor,
  winChanceFor,
  payoutCentsFor,
  normalizeTarget,
  validBet,
  resolveRoll,
};
