const { rollFloat } = require("./provablyFair");

// the daily lottery's rules in one place; src/pages/Lottery/lotteryRules.ts mirrors them for the page and the game info
const POOL = 20;
const PICK = 3;
const PRICE = 100;
const CAP = 50;
const DRAW_HOUR_UTC = 20;
const SALES_CLOSE_MS = 60 * 1000;
// fixed prizes by numbers matched; three is the jackpot, split between every ticket that hits it
const PRIZES = { 0: 0, 1: 100, 2: 300 };
const JACKPOT_BASE = 25000;
// with the 49.2% the fixed tiers return and the base the house puts back after each win, a ticket returns about 96.1%
const JACKPOT_SHARE = 25;
const LOTTERY_ALGO_VERSION = 1;
const DAY = 24 * 60 * 60 * 1000;

const choose = (n, k) => {
  if (k < 0 || k > n) return 0;
  let out = 1;
  for (let i = 1; i <= k; i++) out = (out * (n - k + i)) / i;
  return Math.round(out);
};

const COMBINATIONS = choose(POOL, PICK);
// how many of the possible draws leave a ticket with exactly k of its numbers
const waysToMatch = (k) => choose(PICK, k) * choose(POOL - PICK, PICK - k);
// the share of the price the fixed prizes give back, without the jackpot
const FIXED_RTP = [1, 2].reduce((sum, k) => sum + waysToMatch(k) * PRIZES[k], 0) / (COMBINATIONS * PRICE);

// three distinct whole numbers from 1 to 20, returned sorted; anything else is null
function validPick(pick) {
  if (!Array.isArray(pick) || pick.length !== PICK) return null;
  if (!pick.every((n) => Number.isInteger(n) && n >= 1 && n <= POOL)) return null;
  if (new Set(pick).size !== PICK) return null;
  return [...pick].sort((a, b) => a - b);
}

// one purchase: 1 to 50 valid picks, duplicates allowed; null if any one is not a ticket
function normalizePicks(picks) {
  if (!Array.isArray(picks) || picks.length < 1 || picks.length > CAP) return null;
  const sorted = picks.map(validPick);
  return sorted.every(Boolean) ? sorted : null;
}

const matchCount = (pick, numbers) => pick.filter((n) => numbers.includes(n)).length;

// a fixed tier's prize; a full match is paid from the jackpot instead
const fixedPrize = (matches) => (matches >= PICK ? 0 : PRIZES[matches] || 0);

// equal shares of the jackpot, floored to whole K₽; the remainder stays with the house
const jackpotShare = (jackpot, winners) => (winners > 0 ? Math.floor(jackpot / winners) : 0);

// the three numbers of a draw, from its committed seed and its number alone: hmac(seed, `lottery:${number}:${cursor}`)
// floats drive a partial fisher-yates over 1..20, cursor i picking position i
function drawWith(float) {
  const pool = Array.from({ length: POOL }, (_, i) => i + 1);
  for (let i = 0; i < PICK; i++) {
    const j = i + Math.floor(float(i) * (POOL - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, PICK).sort((a, b) => a - b);
}

const drawNumbers = (serverSeed, drawNumber) => drawWith((cursor) => rollFloat(serverSeed, "lottery", drawNumber, cursor));

// the next 20:00 utc whose sales are still open at `after`, so a new draw never opens already closed
function nextDrawAt(after) {
  const at = new Date(after).getTime();
  let draw = Math.floor(at / DAY) * DAY + DRAW_HOUR_UTC * 60 * 60 * 1000;
  while (draw - SALES_CLOSE_MS <= at) draw += DAY;
  return new Date(draw);
}

const salesCloseAt = (drawAt) => new Date(new Date(drawAt).getTime() - SALES_CLOSE_MS);
const salesOpen = (drawAt, now = new Date()) => new Date(now).getTime() < salesCloseAt(drawAt).getTime();

// what the page needs to price, explain and validate a ticket
const constants = () => ({
  pool: POOL,
  pick: PICK,
  price: PRICE,
  cap: CAP,
  drawHourUtc: DRAW_HOUR_UTC,
  salesCloseMs: SALES_CLOSE_MS,
  prizes: { 1: PRIZES[1], 2: PRIZES[2] },
  jackpotBase: JACKPOT_BASE,
  jackpotShare: JACKPOT_SHARE,
  combinations: COMBINATIONS,
});

module.exports = {
  POOL,
  PICK,
  PRICE,
  CAP,
  DRAW_HOUR_UTC,
  SALES_CLOSE_MS,
  PRIZES,
  JACKPOT_BASE,
  JACKPOT_SHARE,
  LOTTERY_ALGO_VERSION,
  COMBINATIONS,
  FIXED_RTP,
  choose,
  waysToMatch,
  validPick,
  normalizePicks,
  matchCount,
  fixedPrize,
  jackpotShare,
  drawWith,
  drawNumbers,
  nextDrawAt,
  salesCloseAt,
  salesOpen,
  constants,
};
