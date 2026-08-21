const { RANKS, rankOf, suitOf } = require("./pokerCards");

// hand categories, ascending. the number is part of the score, so never reorder them.
const CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
};

const CATEGORY_NAME = [
  "High card",
  "Pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
];

// the score packs the category and five tiebreakers into one comparable integer, base 13
// because a rank is 0..12. five is always enough: no poker hand needs a sixth kicker.
function pack(category, kickers) {
  let score = category;
  for (let i = 0; i < 5; i++) score = score * RANKS + (kickers[i] || 0);
  return score;
}

// highest rank that completes a five-card run, or -1. the wheel (A2345) is the one
// straight whose high card is not its highest rank, so the ace is folded in as a low
// card below the deuce rather than by shifting the whole scale.
function straightHigh(rankSet) {
  const wheel = rankSet.has(12) && rankSet.has(0) && rankSet.has(1) && rankSet.has(2) && rankSet.has(3);
  for (let high = 12; high >= 4; high--) {
    let run = true;
    for (let step = 0; step < 5; step++) {
      if (!rankSet.has(high - step)) {
        run = false;
        break;
      }
    }
    if (run) return high;
  }
  return wheel ? 3 : -1;
}

// evaluate the best five-card hand out of any number of cards (5, 6 or 7). returns the
// packed score plus the parts, so the ui can name the hand without re-deriving it.
function evaluate(cards) {
  const bySuit = [[], [], [], []];
  const rankCount = new Array(RANKS).fill(0);
  const rankSet = new Set();

  for (const card of cards) {
    const rank = rankOf(card);
    bySuit[suitOf(card)].push(rank);
    rankCount[rank] += 1;
    rankSet.add(rank);
  }

  const flushSuit = bySuit.findIndex((ranks) => ranks.length >= 5);

  if (flushSuit >= 0) {
    const flushRanks = bySuit[flushSuit];
    const sfHigh = straightHigh(new Set(flushRanks));
    if (sfHigh >= 0) {
      return {
        score: pack(CATEGORY.STRAIGHT_FLUSH, [sfHigh, 0, 0, 0, 0]),
        category: CATEGORY.STRAIGHT_FLUSH,
        kickers: [sfHigh],
      };
    }
  }

  // ranks grouped by how many copies there are, each group sorted high to low. a longer
  // group always outranks a shorter one, which is what makes quads beat trips beat a pair.
  const byCount = [[], [], [], [], []];
  for (let rank = RANKS - 1; rank >= 0; rank--) {
    if (rankCount[rank]) byCount[rankCount[rank]].push(rank);
  }

  if (byCount[4].length) {
    const quad = byCount[4][0];
    const kicker = [byCount[3], byCount[2], byCount[1], byCount[4].slice(1)]
      .flat()
      .filter((r) => r !== quad)
      .sort((a, b) => b - a)[0];
    return {
      score: pack(CATEGORY.QUADS, [quad, kicker === undefined ? 0 : kicker, 0, 0, 0]),
      category: CATEGORY.QUADS,
      kickers: [quad, kicker],
    };
  }

  const trips = byCount[3];
  const pairs = byCount[2];

  // a second set of trips plays as the pair half of a full house, using its top two cards
  if (trips.length && (pairs.length || trips.length > 1)) {
    const three = trips[0];
    const two = trips.length > 1 ? Math.max(trips[1], pairs[0] === undefined ? -1 : pairs[0]) : pairs[0];
    return {
      score: pack(CATEGORY.FULL_HOUSE, [three, two, 0, 0, 0]),
      category: CATEGORY.FULL_HOUSE,
      kickers: [three, two],
    };
  }

  if (flushSuit >= 0) {
    const top = bySuit[flushSuit].slice().sort((a, b) => b - a).slice(0, 5);
    return { score: pack(CATEGORY.FLUSH, top), category: CATEGORY.FLUSH, kickers: top };
  }

  const runHigh = straightHigh(rankSet);
  if (runHigh >= 0) {
    return {
      score: pack(CATEGORY.STRAIGHT, [runHigh, 0, 0, 0, 0]),
      category: CATEGORY.STRAIGHT,
      kickers: [runHigh],
    };
  }

  const singles = byCount[1];

  if (trips.length) {
    const kickers = [trips[0], ...singles.slice(0, 2)];
    return { score: pack(CATEGORY.TRIPS, kickers), category: CATEGORY.TRIPS, kickers };
  }

  if (pairs.length >= 2) {
    const rest = [...pairs.slice(2), ...singles].sort((a, b) => b - a);
    const kickers = [pairs[0], pairs[1], rest[0] === undefined ? 0 : rest[0]];
    return { score: pack(CATEGORY.TWO_PAIR, kickers), category: CATEGORY.TWO_PAIR, kickers };
  }

  if (pairs.length === 1) {
    const kickers = [pairs[0], ...singles.slice(0, 3)];
    return { score: pack(CATEGORY.PAIR, kickers), category: CATEGORY.PAIR, kickers };
  }

  const kickers = singles.slice(0, 5);
  return { score: pack(CATEGORY.HIGH_CARD, kickers), category: CATEGORY.HIGH_CARD, kickers };
}

// the showdown comparison. equal scores are a genuine tie and split the pot.
const beats = (a, b) => evaluate(a).score > evaluate(b).score;

// seats that tie for the best hand, given a map of seat -> 7 cards
function bestSeats(handsBySeat) {
  let best = -1;
  let winners = [];
  for (const [seat, cards] of Object.entries(handsBySeat)) {
    const { score } = evaluate(cards);
    if (score > best) {
      best = score;
      winners = [Number(seat)];
    } else if (score === best) {
      winners.push(Number(seat));
    }
  }
  return { winners: winners.sort((a, b) => a - b), score: best };
}

module.exports = {
  CATEGORY,
  CATEGORY_NAME,
  pack,
  straightHigh,
  evaluate,
  beats,
  bestSeats,
};
