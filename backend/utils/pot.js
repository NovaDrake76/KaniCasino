// the bonus as a pot that fills over the same eight minutes it always took, claimable at
// any point past a floor. the one rule every number here must keep: no way of claiming
// pays more per minute than waiting for a full pot, so the mint rate is unchanged.
const CYCLE_MS = 8 * 60000;
// below a tenth there is nothing in the pot; it also caps the ledger at ten rows a cycle
const FLOOR = 0.1;
// the last minutes fill fastest, so a full pot pays this much more than the sum of its parts
const PREMIUM = 0.15;
// the extra tenth on top of every claim, spendable only on the day's pick
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

// convex in the fill: fill * (1 - PREMIUM + PREMIUM * fill). per minute that is
// (1 - PREMIUM + PREMIUM * fill) times the full rate, which never exceeds one
const payout = (full, fill) => Math.floor(full * fill * (1 - PREMIUM + PREMIUM * fill));

const creditOf = (amount) => Math.floor(amount * CREDIT_SHARE);

// when the pot next reaches the floor, for a client that asked too early
const floorAt = (nextBonus) => new Date(new Date(nextBonus).getTime() - CYCLE_MS * (1 - FLOOR));

// one pick for everyone per site day, so it is something the room can talk about
const pickFor = (dayIndex) => PICKS[((dayIndex % PICKS.length) + PICKS.length) % PICKS.length];

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
  FLOOR,
  PREMIUM,
  CREDIT_SHARE,
  PICKS,
  GAME_OF_BET,
  fullAmount,
  fillAt,
  payout,
  creditOf,
  floorAt,
  pickFor,
  creditHeld,
  creditsOf,
};
