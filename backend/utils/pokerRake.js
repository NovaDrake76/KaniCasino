// poker has no house edge: the house is not a player, it takes rake. these are the
// ordinary live-room numbers, and they are the whole of the house's income from the game.

const RAKE_PCT = 0.05;
const RAKE_CAP_BB = 3;

// bump when the rake formula changes so old hands stay attributable to the rules they
// were raked under
const POKER_RAKE_VERSION = 1;

// "no flop, no drop": a hand that ends before the flop is raked nothing. the uncalled part
// of a bet is refunded before pots are built, so it never reaches this.
function rakeFor(potTotal, bigBlind, sawFlop) {
  if (!sawFlop || potTotal <= 0) return 0;
  return Math.min(Math.floor(potTotal * RAKE_PCT), RAKE_CAP_BB * bigBlind);
}

// take the rake off the pots. the main pot is always at least as large as any side pot,
// since every player contributes to it, so in practice it absorbs the whole cap; the
// spill is there so a pathological table cannot rake more than exists.
function applyRake(pots, bigBlind, sawFlop) {
  const total = pots.reduce((sum, p) => sum + p.amount, 0);
  let owed = rakeFor(total, bigBlind, sawFlop);
  if (!owed) return { pots, rake: 0 };

  const raked = pots.map((pot) => {
    const take = Math.min(owed, pot.amount);
    owed -= take;
    return { ...pot, amount: pot.amount - take };
  });
  return { pots: raked, rake: rakeFor(total, bigBlind, sawFlop) - owed };
}

module.exports = { RAKE_PCT, RAKE_CAP_BB, POKER_RAKE_VERSION, rakeFor, applyRake };
