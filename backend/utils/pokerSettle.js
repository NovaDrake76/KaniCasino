const { isIn } = require("./pokerBetting");
const { refundUncalled, buildPots, awardPots } = require("./pokerPots");
const { applyRake } = require("./pokerRake");
const { bestSeats } = require("./pokerEval");

// the whole end of a hand in one pure step, so the engine, the recovery sweep and the
// verifier all fold through the same code and cannot disagree about who got paid.
//
// order matters and is not negotiable:
//   1. give back the part of a bet nobody could call, so it is never raked
//   2. build the side pots off what is left
//   3. take the rake, no flop no drop
//   4. award each pot to the best hand among the seats eligible for it
function settleHand({ state, button, bigBlind, sawFlop, holeCards = {}, board = [] }) {
  const seats = state.seats;

  const refund = refundUncalled(seats);
  if (refund) {
    seats[refund.seat].totalCommitted -= refund.amount;
    seats[refund.seat].stack += refund.amount;
  }

  const live = seats.map((s, i) => (isIn(s) ? i : -1)).filter((i) => i >= 0);
  const showdown = live.length > 1;

  // unreachable while the betting engine stops the last player from folding, but chips
  // must never vanish, so an empty table gives every seat its own commitment back
  if (!live.length) {
    for (const s of seats) {
      s.stack += s.totalCommitted;
      s.totalCommitted = 0;
    }
    return { pots: [], rake: 0, refund, won: new Map(), detail: [], showdown: false, live };
  }

  const { pots, rake } = applyRake(buildPots(seats), bigBlind, sawFlop);

  const winnersFor = (eligible) => {
    if (eligible.length <= 1) return eligible;
    if (!showdown) return eligible.filter((seat) => live.includes(seat));
    const hands = {};
    for (const seat of eligible) hands[seat] = [...board, ...(holeCards[seat] || [])];
    return bestSeats(hands).winners;
  };

  const { won, detail } = awardPots(pots, seats, button, winnersFor);
  for (const [seat, amount] of won) seats[seat].stack += amount;

  return { pots, rake, refund, won, detail, showdown, live };
}

// the invariant every settlement must satisfy. chips are never minted and never burned:
// what came to the table leaves it as stacks plus rake.
function chipsBalance(startStacks, state, rake) {
  const before = startStacks.reduce((sum, v) => sum + v, 0);
  const after = state.seats.reduce((sum, s) => sum + s.stack, 0);
  return { before, after: after + rake, ok: before === after + rake };
}

module.exports = { settleHand, chipsBalance };
