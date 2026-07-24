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

// higher-or-equal covers ranks >= r, lower-or-equal covers ranks <= r; both include r,
// so a tie wins either bet (the Stake model) and the two chances overlap on that rank
const hiCount = (rank) => RANKS - rank;
const loCount = (rank) => rank + 1;
const hiChance = (rank) => hiCount(rank) / RANKS;
const loChance = (rank) => loCount(rank) / RANKS;

// per-step multiplier for a direction, 0.99 / chance (99% RTP)
function stepMultiplier(rank, direction) {
  const chance = direction === "hi" ? hiChance(rank) : loChance(rank);
  return RTP / chance;
}

// a guess wins if the next card lands on the predicted side, ties included
function guessWins(currentRank, nextRank, direction) {
  return direction === "hi" ? nextRank >= currentRank : nextRank <= currentRank;
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
