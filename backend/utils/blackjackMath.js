const { rollFloat } = require("./provablyFair");

// bump when any rule or the card mapping changes; the verifier refuses other versions
const BLACKJACK_ALGO_VERSION = 2;

const MIN_BET = 1;
const MAX_BET = 100000;

// infinite deck: every card is an independent uniform 1/52 draw from the seed stream.
// card index 0..51: rank = idx % 13 (0 = ace, 1..8 = 2..9, 9 = ten, 10..12 = J/Q/K),
// suit = floor(idx / 13) (0 = spades, 1 = hearts, 2 = diamonds, 3 = clubs).
function drawCard(serverSeed, clientSeed, nonce, cursor) {
  return Math.floor(rollFloat(serverSeed, clientSeed, nonce, cursor) * 52);
}

function rankOf(card) {
  return card % 13;
}

function suitOf(card) {
  return Math.floor(card / 13);
}

// ace counts 11 here; handTotal downgrades to 1 while the hand would bust
function cardValue(card) {
  const rank = rankOf(card);
  if (rank === 0) return 11;
  if (rank >= 9) return 10;
  return rank + 1;
}

// soft means an ace is still counted as 11
function handTotal(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const value = cardValue(card);
    total += value;
    if (value === 11) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

// a natural: exactly two cards making 21 on an unsplit hand; a split 21 or a
// 3+ card 21 pays 1:1, not 3:2
function isBlackjack(cards) {
  return cards.length === 2 && handTotal(cards).total === 21;
}

// 3:2 with floor on odd bets: total credit for a natural (stake back + winnings)
function naturalPayout(bet) {
  return bet + Math.floor((bet * 3) / 2);
}

// insurance pays 2:1: the side bet back plus twice its amount
function insurancePayout(insuranceBet) {
  return insuranceBet * 3;
}

// dealer stands on all 17s including soft 17 (S17); drawFn yields the next card
function dealerPlay(startCards, drawFn) {
  const cards = startCards.slice();
  while (handTotal(cards).total < 17) {
    cards.push(drawFn());
  }
  return cards;
}

// settle every player hand against the final dealer cards. hands carry their own
// bet (doubled hands already hold 2x). returns per-hand outcome plus the sum owed.
function settle(playerHands, dealerCards) {
  const dealer = handTotal(dealerCards);
  const dealerNatural = isBlackjack(dealerCards);
  const perHand = playerHands.map((hand) => {
    const player = handTotal(hand.cards);
    const playerNatural = isBlackjack(hand.cards) && !hand.doubled && !hand.fromSplit;
    if (player.total > 21) return { outcome: "lose", payout: 0 };
    if (playerNatural && dealerNatural) return { outcome: "push", payout: hand.bet };
    if (playerNatural) return { outcome: "blackjack", payout: naturalPayout(hand.bet) };
    if (dealerNatural) return { outcome: "lose", payout: 0 };
    if (dealer.total > 21 || player.total > dealer.total) return { outcome: "win", payout: hand.bet * 2 };
    if (player.total === dealer.total) return { outcome: "push", payout: hand.bet };
    return { outcome: "lose", payout: 0 };
  });
  return {
    perHand,
    dealerTotal: dealer.total,
    totalPayout: perHand.reduce((sum, h) => sum + h.payout, 0),
  };
}

// ---- the hand state machine ----
// one pure machine drives the live game, the recovery sweep and the verifier, so
// they can never disagree. state is a plain serializable object; draw(cursor)
// supplies cards from the committed seed stream in chronological order.

function newHand(cards, bet, fromSplit = false) {
  return { cards, bet, doubled: false, fromSplit, done: false };
}

// price the round and freeze the machine. the dealer only draws when at least
// one hand survived and the round didn't already end on a peeked natural.
function finishRound(state, draw) {
  const anyLive = state.hands.some((h) => handTotal(h.cards).total <= 21);
  if (anyLive && !state.peekedBlackjack) {
    state.dealerCards = dealerPlay(state.dealerCards, () => draw(state.nextCursor++));
  }
  const result = settle(state.hands, state.dealerCards);
  result.totalPayout += state.insuranceWon;
  result.won =
    state.insuranceWon > 0 ||
    result.perHand.some((h) => h.outcome === "win" || h.outcome === "blackjack");
  state.result = result;
  state.finished = true;
  return state;
}

// move to the next undone hand; a freshly activated split hand draws its second
// card at that moment (chronological stream), and an auto-21 stands immediately
function advance(state, draw) {
  while (
    state.activeHandIndex < state.hands.length &&
    state.hands[state.activeHandIndex].done
  ) {
    state.activeHandIndex += 1;
    const next = state.hands[state.activeHandIndex];
    if (!next) break;
    if (next.cards.length === 1) {
      next.cards.push(draw(state.nextCursor++));
      if (state.aceSplit) next.done = true;
    }
    if (handTotal(next.cards).total === 21) next.done = true;
  }
  if (state.activeHandIndex >= state.hands.length) return finishRound(state, draw);
  return state;
}

// the initial deal. an ace upcard pauses for the insurance decision before the
// peek; any other two-card 21 (either side) settles immediately (american peek).
function dealState(betAmount, draw) {
  const playerCards = [draw(0), draw(2)];
  const dealerCards = [draw(1), draw(3)];
  // cursor order is fixed: 0 player, 1 dealer up, 2 player, 3 dealer hole
  const state = {
    hands: [newHand(playerCards, betAmount)],
    activeHandIndex: 0,
    dealerCards,
    nextCursor: 4,
    betAmount,
    awaitingInsurance: rankOf(dealerCards[0]) === 0,
    insuranceBet: 0,
    insuranceWon: 0,
    aceSplit: false,
    peekedBlackjack: false,
    finished: false,
    result: null,
  };
  if (state.awaitingInsurance) return state;
  if (isBlackjack(playerCards) || isBlackjack(dealerCards)) {
    state.peekedBlackjack = true;
    return finishRound(state, draw);
  }
  if (handTotal(playerCards).total === 21) {
    state.hands[0].done = true;
    return advance(state, draw);
  }
  return state;
}

// resolve the insurance decision, then peek. a dealer natural ends the round
// here (the side bet pays 2:1); otherwise the side bet is lost and play begins.
function applyInsurance(state, accept, draw) {
  if (!state.awaitingInsurance || state.finished) throw new Error("no insurance pending");
  state.awaitingInsurance = false;
  state.insuranceBet = accept ? Math.floor(state.betAmount / 2) : 0;
  if (isBlackjack(state.dealerCards)) {
    state.insuranceWon = accept ? insurancePayout(state.insuranceBet) : 0;
    state.peekedBlackjack = true;
    return finishRound(state, draw);
  }
  if (isBlackjack(state.hands[0].cards)) {
    state.peekedBlackjack = true;
    return finishRound(state, draw);
  }
  if (handTotal(state.hands[0].cards).total === 21) {
    state.hands[0].done = true;
    return advance(state, draw);
  }
  return state;
}

// hit / stand / double / split on the active hand
function applyMove(state, move, draw) {
  if (state.finished || state.awaitingInsurance) throw new Error("no move allowed");
  const hand = state.hands[state.activeHandIndex];
  if (!hand || hand.done) throw new Error("no active hand");

  if (move === "hit") {
    if (handTotal(hand.cards).total >= 21) throw new Error("cannot hit");
    hand.cards.push(draw(state.nextCursor++));
    if (handTotal(hand.cards).total >= 21) hand.done = true;
  } else if (move === "stand") {
    hand.done = true;
  } else if (move === "double") {
    if (hand.cards.length !== 2 || hand.doubled) throw new Error("cannot double");
    hand.cards.push(draw(state.nextCursor++));
    hand.bet *= 2;
    hand.doubled = true;
    hand.done = true;
  } else if (move === "split") {
    if (
      state.hands.length !== 1 ||
      hand.cards.length !== 2 ||
      rankOf(hand.cards[0]) !== rankOf(hand.cards[1]) ||
      hand.doubled
    ) {
      throw new Error("cannot split");
    }
    // split once, equal rank; aces take exactly one card each and stand
    state.aceSplit = rankOf(hand.cards[0]) === 0;
    state.hands = [
      newHand([hand.cards[0]], hand.bet, true),
      newHand([hand.cards[1]], hand.bet, true),
    ];
    const first = state.hands[0];
    first.cards.push(draw(state.nextCursor++));
    if (state.aceSplit || handTotal(first.cards).total === 21) first.done = true;
  } else {
    throw new Error("unknown move");
  }
  return advance(state, draw);
}

// what the current state allows; drives route validation and the client buttons
function legalMoves(state) {
  const none = { canHit: false, canStand: false, canDouble: false, canSplit: false, canInsure: false };
  if (state.finished) return none;
  if (state.awaitingInsurance) {
    return { ...none, canInsure: Math.floor(state.betAmount / 2) >= 1 };
  }
  const hand = state.hands[state.activeHandIndex];
  if (!hand || hand.done) return none;
  return {
    canHit: handTotal(hand.cards).total < 21,
    canStand: true,
    canDouble: hand.cards.length === 2 && !hand.doubled,
    canSplit:
      state.hands.length === 1 &&
      hand.cards.length === 2 &&
      rankOf(hand.cards[0]) === rankOf(hand.cards[1]) &&
      !hand.doubled,
    canInsure: false,
  };
}

// replay a whole hand from the seed material and the recorded action list. the
// controller, the sweep and the public verifier all fold through this machine,
// so the live game and verification can never disagree about the cards.
function replayHand({ serverSeed, clientSeed, nonce, betAmount, actions }) {
  const draw = (cursor) => drawCard(serverSeed, clientSeed, nonce, cursor);
  let state = dealState(betAmount, draw);
  for (const entry of actions || []) {
    if (state.finished) break;
    const action = typeof entry === "string" ? entry : entry.action;
    if (action === "deal") continue;
    if (action === "insure") state = applyInsurance(state, true, draw);
    else if (action === "noinsure") state = applyInsurance(state, false, draw);
    else state = applyMove(state, action, draw);
  }
  return {
    hands: state.hands,
    dealerCards: state.dealerCards,
    nextCursor: state.nextCursor,
    insuranceBet: state.insuranceBet,
    perHand: state.result ? state.result.perHand : [],
    dealerTotal: state.result ? state.result.dealerTotal : null,
    totalPayout: state.result ? state.result.totalPayout : 0,
    finished: state.finished,
  };
}

module.exports = {
  BLACKJACK_ALGO_VERSION,
  MIN_BET,
  MAX_BET,
  drawCard,
  rankOf,
  suitOf,
  cardValue,
  handTotal,
  isBlackjack,
  naturalPayout,
  insurancePayout,
  dealerPlay,
  settle,
  dealState,
  applyInsurance,
  applyMove,
  legalMoves,
  replayHand,
};
