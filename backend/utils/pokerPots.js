const { isIn } = require("./pokerBetting");

// chips nobody could match are not in play. if one seat committed more than any other
// seat could cover, the excess goes straight back before any pot is built, which is also
// why it never gets raked.
function refundUncalled(seats) {
  let top = -1;
  let topAmount = -1;
  let second = 0;
  seats.forEach((s, i) => {
    const amount = s.totalCommitted || 0;
    if (amount > topAmount) {
      second = topAmount < 0 ? 0 : topAmount;
      top = i;
      topAmount = amount;
    } else if (amount > second) {
      second = amount;
    }
  });
  if (top < 0 || topAmount <= second) return null;
  return { seat: top, amount: topAmount - second, cappedAt: second };
}

// one pot per distinct all-in level. a seat is eligible for a pot only if it reached that
// level and did not fold; folded chips still sit in the pot they were committed to.
function buildPots(seats) {
  const levels = [
    ...new Set(seats.filter((s) => isIn(s) && s.totalCommitted > 0).map((s) => s.totalCommitted)),
  ].sort((a, b) => a - b);

  const pots = [];
  let previous = 0;
  for (const level of levels) {
    let amount = 0;
    for (const s of seats) {
      amount += Math.max(0, Math.min(s.totalCommitted || 0, level) - previous);
    }
    const eligible = seats
      .map((s, i) => (isIn(s) && (s.totalCommitted || 0) >= level ? i : -1))
      .filter((i) => i >= 0);
    if (amount > 0) pots.push({ amount, eligible });
    previous = level;
  }

  // adjacent layers with the same eligible set are one pot as far as anyone can tell
  const merged = [];
  for (const pot of pots) {
    const last = merged[merged.length - 1];
    if (last && last.eligible.join(",") === pot.eligible.join(",")) last.amount += pot.amount;
    else merged.push(pot);
  }

  // dead money: chips a player folded away above anything a live player matched. it is
  // still in the pot and still belongs to whoever wins the top one, so it is swept into
  // the highest layer rather than left orphaned. only reachable when everybody who could
  // cover it folded, which the simulation does find.
  const committed = seats.reduce((sum, s) => sum + (s.totalCommitted || 0), 0);
  const assigned = merged.reduce((sum, p) => sum + p.amount, 0);
  if (committed > assigned) {
    const live = seats.map((s, i) => (isIn(s) ? i : -1)).filter((i) => i >= 0);
    if (merged.length) merged[merged.length - 1].amount += committed - assigned;
    else if (live.length) merged.push({ amount: committed - assigned, eligible: live });
  }
  return merged;
}

// odd chips go to the first winner clockwise from the button, which is the standard rule
// and the only one that does not quietly favour a seat index. the button itself is last,
// not first: it is the latest position, so it is the last to be handed a spare chip.
function oddChipOrder(winners, seats, button) {
  const size = seats.length;
  const distance = (seat) => (seat - button - 1 + size * 2) % size;
  return winners.slice().sort((a, b) => distance(a) - distance(b));
}

// split one pot between the seats that tie for it
function splitPot(amount, winners, seats, button) {
  const order = oddChipOrder(winners, seats, button);
  const share = Math.floor(amount / order.length);
  let remainder = amount - share * order.length;
  const payout = new Map();
  for (const seat of order) {
    let take = share;
    if (remainder > 0) {
      take += 1;
      remainder -= 1;
    }
    payout.set(seat, take);
  }
  return payout;
}

// award every pot. `winnersFor(eligible)` returns the tying seats for that pot, which lets
// the caller decide between a showdown and a last-player-standing win.
function awardPots(pots, seats, button, winnersFor) {
  const won = new Map();
  const detail = [];
  for (const pot of pots) {
    const winners = winnersFor(pot.eligible);
    const payout = splitPot(pot.amount, winners, seats, button);
    for (const [seat, amount] of payout) {
      won.set(seat, (won.get(seat) || 0) + amount);
    }
    detail.push({ amount: pot.amount, eligible: pot.eligible, winners, payout: [...payout] });
  }
  return { won, detail };
}

const potTotal = (pots) => pots.reduce((sum, p) => sum + p.amount, 0);

module.exports = {
  refundUncalled,
  buildPots,
  splitPot,
  oddChipOrder,
  awardPots,
  potTotal,
};
