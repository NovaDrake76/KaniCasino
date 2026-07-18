const { rollFloat } = require("./provablyFair");

const PLINKO_ALGO_VERSION = 1; // bump if the row count or a payout table changes

const ROWS = 16;

// multipliers in integer cents per landing bin (0..16), symmetric around the center.
// tables are tuned to a ~3.5% house edge on every risk, in line with slots and crash.
const PAYOUTS = {
  low: [1500, 800, 220, 160, 130, 110, 105, 95, 60, 95, 105, 110, 130, 160, 220, 800, 1500],
  medium: [10000, 4000, 900, 500, 290, 140, 100, 50, 30, 50, 100, 140, 290, 500, 900, 4000, 10000],
  high: [100000, 12000, 2500, 900, 400, 170, 30, 20, 20, 20, 30, 170, 400, 900, 2500, 12000, 100000],
};

// one draw per row; below 0.5 deflects the ball left, otherwise right (an unbiased bit per peg)
function derivePath(serverSeed, clientSeed, nonce) {
  let path = "";
  for (let row = 0; row < ROWS; row++) {
    path += rollFloat(serverSeed, clientSeed, nonce, row) < 0.5 ? "L" : "R";
  }
  return path;
}

// the landing bin is simply how many pegs sent the ball right
function binFromPath(path) {
  let bin = 0;
  for (const step of path) {
    if (step === "R") bin += 1;
  }
  return bin;
}

module.exports = { PLINKO_ALGO_VERSION, ROWS, PAYOUTS, derivePath, binFromPath };
