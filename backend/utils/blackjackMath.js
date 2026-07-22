const { rollFloat } = require("./provablyFair");

// bump when any rule or the card mapping changes; the verifier refuses other versions
const BLACKJACK_ALGO_VERSION = 1;

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

// a natural: exactly two cards making 21. a 3+ card 21 pays 1:1, not 3:2
function isBlackjack(cards) {
  return cards.length === 2 && handTotal(cards).total === 21;
}

// 3:2 with floor on odd bets: total credit for a natural (stake back + winnings)
function naturalPayout(bet) {
  return bet + Math.floor((bet * 3) / 2);
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
    const playerNatural = isBlackjack(hand.cards) && !hand.doubled;
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

// replay a whole hand from the seed material and the recorded action list. the
// controller's recovery path and the public verifier both call this, so the live
// game and verification can never disagree about what the cards were.
function replayHand({ serverSeed, clientSeed, nonce, betAmount, actions }) {
  const draw = (cursor) => drawCard(serverSeed, clientSeed, nonce, cursor);
  const playerCards = [draw(0), draw(2)];
  let dealerCards = [draw(1), draw(3)];
  let nextCursor = 4;
  const hand = { cards: playerCards, bet: betAmount, doubled: false };

  // naturals settle at the deal (american peek): no further cards are ever drawn
  if (isBlackjack(playerCards) || isBlackjack(dealerCards)) {
    const result = settle([hand], dealerCards);
    return { hands: [hand], dealerCards, nextCursor, ...result };
  }

  let stood = false;
  for (const entry of actions) {
    const action = typeof entry === "string" ? entry : entry.action;
    if (action === "deal") continue;
    if (action === "hit") {
      hand.cards.push(draw(nextCursor++));
      const { total } = handTotal(hand.cards);
      if (total > 21) {
        // all hands busted: hole is revealed but the dealer draws nothing
        const result = settle([hand], dealerCards);
        return { hands: [hand], dealerCards, nextCursor, ...result };
      }
      if (total === 21) {
        stood = true;
        break;
      }
    } else if (action === "double") {
      hand.cards.push(draw(nextCursor++));
      hand.bet = betAmount * 2;
      hand.doubled = true;
      stood = true;
      break;
    } else if (action === "stand") {
      stood = true;
      break;
    }
  }

  if (stood && handTotal(hand.cards).total <= 21) {
    dealerCards = dealerPlay(dealerCards, () => draw(nextCursor++));
  }
  const result = settle([hand], dealerCards);
  return { hands: [hand], dealerCards, nextCursor, ...result };
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
  dealerPlay,
  settle,
  replayHand,
};
