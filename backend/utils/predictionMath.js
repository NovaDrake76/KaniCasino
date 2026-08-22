// the pricing curve, pure. no io, no database, no money: the caller hands in prices and a
// trade and gets back what it costs and where the prices land.
//
// prices are integer basis points, never floats. 4000 is 0.40 is "40%". a float price
// multiplied by a share count and rounded is exactly how a balance picks up a fraction of
// a KP that nobody can account for later, so the whole curve is integer arithmetic and the
// only rounding happens once, at the end, in a stated direction.

const ONE = 10000; // 1.00 in basis points
const PRICE_MIN = 100; // 0.01 — a market never says something is impossible
const PRICE_MAX = 9900; // 0.99 — nor certain

// how far one share moves a price. per market, because a busy market should be harder to
// shove than a quiet one, but this is the default.
const DEFAULT_IMPACT_BPS = 10; // 0.001, the original's number

// the overround. outcome prices sum to 1 + vig rather than to 1, which is the house's
// margin and the reason this game does not mint KP on every resolution. a player still
// reads percentages; they simply add up to 104 the way they do on any bookmaker.
const DEFAULT_VIG_BPS = 400; // 4%

const clampPrice = (bps) => Math.max(PRICE_MIN, Math.min(PRICE_MAX, Math.round(bps)));

const sum = (list) => list.reduce((total, n) => total + n, 0);

// what a set of prices is supposed to add up to
const targetSum = (vigBps = DEFAULT_VIG_BPS) => ONE + vigBps;

// the opening book for a market: every outcome equally likely, inflated by the vig
function openingPrices(outcomeCount, vigBps = DEFAULT_VIG_BPS) {
  if (outcomeCount < 2) throw new Error("a market needs at least two outcomes");
  const total = targetSum(vigBps);
  const each = Math.floor(total / outcomeCount);
  const prices = new Array(outcomeCount).fill(clampPrice(each));
  return settleRounding(prices, total);
}

// integer division leaves a few basis points unaccounted for; they go on the largest
// price, which is the one where they are least visible as a distortion
function settleRounding(prices, total) {
  const drift = total - sum(prices);
  if (drift === 0) return prices;
  let at = 0;
  for (let i = 1; i < prices.length; i++) if (prices[i] > prices[at]) at = i;
  const next = prices.slice();
  next[at] = clampPrice(next[at] + drift);
  return next;
}

// twice the cost in basis points, kept doubled so the average of two integers stays exact
// until the single rounding at the end.
//
// the curve is a straight ramp until the price hits its cap or floor and then flat there,
// which is what stops a huge order running off the end. the trader pays the average across
// the fill rather than the price they finish at, so a buy and an immediate sell of the same
// size come back to where they started and cannot be farmed.
function rampCost(shares, startBps, isBuy, impactBps = DEFAULT_IMPACT_BPS) {
  if (shares <= 0) return { twiceBps: 0, endBps: startBps, avgBps: startBps };

  const bound = isBuy ? PRICE_MAX : PRICE_MIN;
  const room = isBuy ? bound - startBps : startBps - bound;
  const rampShares = Math.max(0, Math.min(shares, Math.floor(room / impactBps)));
  const endRamp = isBuy
    ? startBps + rampShares * impactBps
    : startBps - rampShares * impactBps;

  const flatShares = shares - rampShares;
  const twiceBps = rampShares * (startBps + endRamp) + flatShares * 2 * bound;
  const endBps = flatShares > 0 ? bound : endRamp;

  return { twiceBps, endBps, avgBps: twiceBps / (2 * shares) };
}

// bps-shares to whole KP. a buy rounds up and a sell rounds down, both in the house's
// favour, so a round trip costs a KP or two rather than being free money at scale.
const toKp = (twiceBps, isBuy) =>
  isBuy ? Math.ceil(twiceBps / (2 * ONE)) : Math.floor(twiceBps / (2 * ONE));

// after one outcome moves, the rest share what is left of the target sum in proportion to
// where they already were. a market whose prices no longer add up is a market you can buy
// every outcome of for less than it pays.
function rebalance(prices, movedIndex, movedPrice, vigBps = DEFAULT_VIG_BPS) {
  const total = targetSum(vigBps);
  const others = prices.length - 1;
  if (others === 0) return [clampPrice(movedPrice)];

  // the moved price cannot take so much of the budget that the others fall under the floor
  const ceiling = total - others * PRICE_MIN;
  const moved = clampPrice(Math.min(movedPrice, ceiling));
  const budget = total - moved;

  const restSum = sum(prices.filter((_, i) => i !== movedIndex));
  const next = prices.map((price, i) => {
    if (i === movedIndex) return moved;
    // a book that has collapsed to nothing splits the budget evenly rather than dividing
    // by zero
    const share = restSum > 0 ? (price / restSum) * budget : budget / others;
    return clampPrice(share);
  });

  return settleRoundingExcept(next, total, movedIndex);
}

// same idea as settleRounding, but the outcome that was just traded keeps the price the
// trade produced: moving it again would mean charging for one price and storing another
function settleRoundingExcept(prices, total, keepIndex) {
  const drift = total - sum(prices);
  if (drift === 0) return prices;
  let at = -1;
  for (let i = 0; i < prices.length; i++) {
    if (i === keepIndex) continue;
    if (at === -1 || prices[i] > prices[at]) at = i;
  }
  if (at === -1) return prices;
  const next = prices.slice();
  next[at] = clampPrice(next[at] + drift);
  return next;
}

// the whole quote in one call. the trade panel and the server both go through this, so the
// number a player is shown is the number they are charged.
function preview({ prices, index, shares, action, impactBps = DEFAULT_IMPACT_BPS, vigBps = DEFAULT_VIG_BPS }) {
  if (!Array.isArray(prices) || prices.length < 2) return { error: "Bad market" };
  if (!Number.isInteger(index) || index < 0 || index >= prices.length) return { error: "No such outcome" };
  if (!Number.isInteger(shares) || shares <= 0) return { error: "Shares must be a whole number above zero" };
  if (action !== "buy" && action !== "sell") return { error: "Unknown action" };

  const isBuy = action === "buy";
  const startBps = prices[index];
  const { twiceBps, endBps, avgBps } = rampCost(shares, startBps, isBuy, impactBps);

  return {
    shares,
    amount: toKp(twiceBps, isBuy),
    avgBps: Math.round(avgBps),
    startBps,
    endBps,
    prices: rebalance(prices, index, endBps, vigBps),
  };
}

// what the house would owe if this outcome came true: one KP for every share of it that is
// held. the cap is checked against this rather than against volume, because a market with a
// lot of round-trip churn has high volume and no exposure at all.
const exposureOf = (sharesOutstanding) => sharesOutstanding;

module.exports = {
  ONE,
  PRICE_MIN,
  PRICE_MAX,
  DEFAULT_IMPACT_BPS,
  DEFAULT_VIG_BPS,
  clampPrice,
  targetSum,
  openingPrices,
  rampCost,
  toKp,
  rebalance,
  preview,
  exposureOf,
};
