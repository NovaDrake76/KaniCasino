const { rollFloat } = require("./provablyFair");

// bump when the shuffle or the deal order changes; the verifier refuses other versions
const POKER_ALGO_VERSION = 1;

const DECK = 52;
const RANKS = 13;
const SUITS = 4;

// rank 0..12 is 2,3,4,5,6,7,8,9,T,J,Q,K,A. deliberately not hilo's ordering, which puts
// the ace at 0: poker needs the ace high, and the wheel is handled as a special case in
// the evaluator rather than by moving the whole scale.
const RANK_CHARS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUIT_CHARS = ["s", "h", "d", "c"];

const rankOf = (card) => card % RANKS;
const suitOf = (card) => Math.floor(card / RANKS);
const cardName = (card) => RANK_CHARS[rankOf(card)] + SUIT_CHARS[suitOf(card)];

// parse "As" / "Td" back to a card index. only used by tests and the verifier
function cardFromName(name) {
  const rank = RANK_CHARS.indexOf(String(name)[0].toUpperCase());
  const suit = SUIT_CHARS.indexOf(String(name)[1].toLowerCase());
  if (rank < 0 || suit < 0) return -1;
  return suit * RANKS + rank;
}

// fisher-yates driven by the same hmac primitive every other game uses. one draw per
// swap, so the cursor walks 0..50 and a third party can reproduce the deck from the
// revealed seed alone.
function shuffle(serverSeed, clientSeed, handNumber) {
  const deck = Array.from({ length: DECK }, (_, i) => i);
  for (let i = DECK - 1; i > 0; i--) {
    const cursor = DECK - 1 - i;
    const j = Math.floor(rollFloat(serverSeed, clientSeed, handNumber, cursor) * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

// no burn cards: they exist in a live room to defeat card marking and add nothing to a
// seeded deal, so leaving them out keeps the deal order trivial to verify.
// positions are fixed: hole cards round-robin from the first seat in `order`, then the
// board straight after them.
function deal(deck, playerCount) {
  const holes = [];
  for (let p = 0; p < playerCount; p++) holes.push([deck[p], deck[playerCount + p]]);
  const top = playerCount * 2;
  return {
    holes,
    flop: [deck[top], deck[top + 1], deck[top + 2]],
    turn: deck[top + 3],
    river: deck[top + 4],
  };
}

// how much of the board is face up on each street
const BOARD_AT = { preflop: 0, flop: 3, turn: 4, river: 5, showdown: 5 };

function boardFor(dealt, street) {
  const all = [...dealt.flop, dealt.turn, dealt.river];
  return all.slice(0, BOARD_AT[street] || 0);
}

module.exports = {
  POKER_ALGO_VERSION,
  DECK,
  RANKS,
  SUITS,
  RANK_CHARS,
  SUIT_CHARS,
  rankOf,
  suitOf,
  cardName,
  cardFromName,
  shuffle,
  deal,
  boardFor,
  BOARD_AT,
};
