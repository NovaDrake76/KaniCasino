const { rollFloat } = require("./provablyFair");

// bump when the card mapping or the multiplier formula changes; the verifier refuses
// other versions
const HILO_ALGO_VERSION = 1;

const RANKS = 13;
const DECK = 52;
const MIN_BET = 1;
const MAX_BET = 10000;
// a long lucky streak can compound past a million; the payout is capped like the other games
const MAX_PAYOUT = 1_000_000;
const MAX_SKIPS = 52;
const RTP = 0.99;

// card 0..51, rank = card % 13 (0 = ace, the lowest, 12 = king, the highest), suit = floor/13
function cardAt(serverSeed, clientSeed, nonce, cursor) {
  return Math.floor(rollFloat(serverSeed, clientSeed, nonce, cursor) * DECK);
}
const rankOf = (card) => card % RANKS;

// a tie (same rank) wins both sides for a middle card, so their chances overlap on that
// rank. for the extremes the tie only wins the minority side, so neither ace nor king
// ever offers a 100% (0.99x) bet: an ace's "higher" is strictly higher (the tie falls to
// "lower"), a king's "lower" is strictly lower (the tie falls to "higher").
const hiCount = (rank) => (rank === 0 ? RANKS - 1 : RANKS - rank);
const loCount = (rank) => (rank === RANKS - 1 ? RANKS - 1 : rank + 1);
const hiChance = (rank) => hiCount(rank) / RANKS;
const loChance = (rank) => loCount(rank) / RANKS;

// per-step multiplier for a direction, 0.99 / chance (99% RTP)
function stepMultiplier(rank, direction) {
  const chance = direction === "hi" ? hiChance(rank) : loChance(rank);
  return RTP / chance;
}

// a guess wins if the next card lands on the predicted side. a tie wins both, except on
// an ace (the tie goes only to "lower") and a king (only to "higher"), matching the counts
function guessWins(currentRank, nextRank, direction) {
  if (direction === "hi") {
    return nextRank > currentRank || (nextRank === currentRank && currentRank !== 0);
  }
  return nextRank < currentRank || (nextRank === currentRank && currentRank !== RANKS - 1);
}

function validBet(betAmount) {
  return Number.isInteger(betAmount) && betAmount >= MIN_BET && betAmount <= MAX_BET;
}

function payoutCentsFor(betAmount, multiplier) {
  return Math.min(Math.round(betAmount * multiplier * 100), MAX_PAYOUT * 100);
}

// replay a whole game from the seed material and the recorded action list. one draw per
// card at successive cursors (cursor 0 = the start card). the controller, the sweep and
// the verifier all fold through this, so they cannot disagree about the cards.
function resolveHilo({ serverSeed, clientSeed, nonce, betAmount, actions }) {
  const cards = [cardAt(serverSeed, clientSeed, nonce, 0)];
  let multiplier = 1;
  let guesses = 0;
  let skips = 0;
  let busted = false;

  const list = actions || [];
  for (let i = 0; i < list.length; i++) {
    const action = typeof list[i] === "string" ? list[i] : list[i].action;
    const next = cardAt(serverSeed, clientSeed, nonce, i + 1);
    cards.push(next);
    if (action === "skip") {
      skips += 1;
      continue;
    }
    const direction = action === "guess-hi" ? "hi" : "lo";
    if (guessWins(rankOf(cards[i]), rankOf(next), direction)) {
      multiplier *= stepMultiplier(rankOf(cards[i]), direction);
      guesses += 1;
    } else {
      busted = true;
      break;
    }
  }

  const payout = busted || guesses === 0 ? 0 : payoutCentsFor(betAmount, multiplier) / 100;
  return { cards, multiplier, guesses, skips, busted, payout };
}

module.exports = {
  HILO_ALGO_VERSION,
  RANKS,
  DECK,
  MIN_BET,
  MAX_BET,
  MAX_PAYOUT,
  MAX_SKIPS,
  RTP,
  cardAt,
  rankOf,
  hiChance,
  loChance,
  stepMultiplier,
  guessWins,
  validBet,
  payoutCentsFor,
  resolveHilo,
};
