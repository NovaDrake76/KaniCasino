const { rollFloat } = require("./provablyFair");

// bump when the mine derivation or the multiplier formula changes; the verifier refuses
// other versions
const MINES_ALGO_VERSION = 1;

const TILES = 25; // 5x5 grid
const MIN_MINES = 1;
const MAX_MINES = 24; // at least one gem must remain
const MIN_BET = 1;
const MAX_BET = 10000;
// some mid configs exceed a million-times multiplier; the payout is capped so the max
// win stays bounded like the other games
const MAX_PAYOUT = 1_000_000;
const RTP = 0.99;

function validMineCount(mineCount) {
  return Number.isInteger(mineCount) && mineCount >= MIN_MINES && mineCount <= MAX_MINES;
}

function validBet(betAmount) {
  return Number.isInteger(betAmount) && betAmount >= MIN_BET && betAmount <= MAX_BET;
}

// derive the mine positions deterministically from the seed: a partial Fisher-Yates over
// [0..24] using one draw per placed mine, so the layout is fixed at deal time and any
// third party reproduces it from the revealed seed. returns a sorted array of indices.
function deriveMines(serverSeed, clientSeed, nonce, mineCount) {
  const order = Array.from({ length: TILES }, (_, i) => i);
  for (let i = 0; i < mineCount; i++) {
    const j = i + Math.floor(rollFloat(serverSeed, clientSeed, nonce, i) * (TILES - i));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order.slice(0, mineCount).sort((a, b) => a - b);
}

// fair multiplier for revealing `gems` safe tiles with `mineCount` mines, times the RTP.
// at pick i there are (TILES - i) tiles, (TILES - mineCount - i) of them safe, so the
// survival probability is the product of those ratios and the fair multiplier is its
// inverse. returns 1 for zero gems (nothing revealed yet).
function multiplierFor(mineCount, gems) {
  let m = 1;
  for (let i = 0; i < gems; i++) {
    m *= (TILES - i) / (TILES - mineCount - i);
  }
  return gems === 0 ? 1 : RTP * m;
}

// payout in whole cents for a cashout, capped at MAX_PAYOUT
function payoutCentsFor(betAmount, mineCount, gems) {
  const raw = betAmount * multiplierFor(mineCount, gems);
  return Math.min(Math.round(raw * 100), MAX_PAYOUT * 100);
}

module.exports = {
  MINES_ALGO_VERSION,
  TILES,
  MIN_MINES,
  MAX_MINES,
  MIN_BET,
  MAX_BET,
  MAX_PAYOUT,
  RTP,
  validMineCount,
  validBet,
  deriveMines,
  multiplierFor,
  payoutCentsFor,
};
