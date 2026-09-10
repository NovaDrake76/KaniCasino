// the bonus as a pot that fills over the same eight minutes it always took, taken by
// clicking the jar as often as the player likes. the one rule every number here must keep:
// no way of taking pays more per minute than waiting for a full pot, so the mint rate is
// exactly what the old button paid.
const CYCLE_MS = 8 * 60000;
// a click that would pay less than this finds the jar empty
const MIN_CLAIM = 1;
// what clicking pays per minute against waiting for full. full is the ceiling, so every
// early take is this fraction of it, and the gap is what the ui calls the full-pot bonus
const CLICK_RATE = 0.8;
const FULL_BONUS = 1 / CLICK_RATE - 1;
// the extra tenth on top of every take, spendable only on the current pick
const CREDIT_SHARE = 0.1;
// the games a credit can be spent on: single-request games whose stake never comes back
// as a refund, so a credit can only turn into real KP by being played
const PICKS = ["slots", "dice", "plinko", "mines", "blackjack", "hilo"];
const GAME_OF_BET = {
  slot_bet: "slots",
  dice_bet: "dice",
  plinko_bet: "plinko",
  mines_bet: "mines",
  blackjack_bet: "blackjack",
  hilo_bet: "hilo",
};

// the same size the navbar button paid at this level
const fullAmount = (level) => Math.floor(200 * (1 + 0.1 * (level || 0)));

// how full the pot is right now, from when the current cycle started
const fillAt = (nextBonus, now = new Date()) => {
  const startedAt = new Date(nextBonus).getTime() - CYCLE_MS;
  const fill = (now.getTime() - startedAt) / CYCLE_MS;
  return Math.max(0, Math.min(1, fill));
};

// convex in the fill: fill * (CLICK_RATE + (1 - CLICK_RATE) * fill). per minute that is
// (CLICK_RATE + (1 - CLICK_RATE) * fill) times the full rate, which never exceeds one
const payout = (full, fill) => Math.floor(full * fill * (CLICK_RATE + (1 - CLICK_RATE) * fill));

// kept to the cent so a small click still leaves something on the pick
const creditOf = (amount) => Math.round(amount * CREDIT_SHARE * 100) / 100;

// when a click would first find MIN_CLAIM in the jar, from the start of the cycle
const readyAt = (nextBonus, full) => {
  const startedAt = new Date(nextBonus).getTime() - CYCLE_MS;
  const fill = full > 0 ? Math.min(1, MIN_CLAIM / (full * CLICK_RATE)) : 1;
  return new Date(startedAt + CYCLE_MS * fill);
};

const pickAt = (index) => PICKS[(((index || 0) % PICKS.length) + PICKS.length) % PICKS.length];

// one pot's worth per pick: the tenth rides on the current pick until a full pot has been
// taken, however it was taken, then the next game gets it
const advancePick = (index, cycleClaimed, amount, full) => {
  let claimed = (cycleClaimed || 0) + amount;
  let i = index || 0;
  while (full > 0 && claimed >= full) {
    claimed -= full;
    i += 1;
  }
  return { index: i, cycleClaimed: claimed };
};

// works on a hydrated doc, a lean one, or a user that has never held a credit
const creditHeld = (user, game) => {
  const credits = user && user.gameCredits;
  if (!credits) return 0;
  const held = typeof credits.get === "function" ? credits.get(game) : credits[game];
  return Number(held) || 0;
};

const creditsOf = (user) => {
  const credits = (user && user.gameCredits) || {};
  const entries = typeof credits.entries === "function" && !Array.isArray(credits) ? [...credits.entries()] : Object.entries(credits);
  const out = {};
  for (const [game, held] of entries) if (Number(held) > 0) out[game] = Number(held);
  return out;
};

module.exports = {
  CYCLE_MS,
  MIN_CLAIM,
  CLICK_RATE,
  FULL_BONUS,
  CREDIT_SHARE,
  PICKS,
  GAME_OF_BET,
  fullAmount,
  fillAt,
  payout,
  creditOf,
  readyAt,
  pickAt,
  advancePick,
  creditHeld,
  creditsOf,
};
