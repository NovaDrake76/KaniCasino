// the bonus as a pot that fills over the same eight minutes it always took, taken by clicking the jar as often as the player likes; the one rule every number here must keep is that no way of taking pays more per minute than waiting for a full pot, so the mint rate is exactly what the old button paid
const CYCLE_MS = 8 * 60000;
// a click that would pay less than this finds the jar empty
const MIN_CLAIM = 1;
// what clicking pays per minute against waiting for full. full is the ceiling, so every
// early take is this fraction of it, and the gap is what the ui calls the full-pot bonus
const CLICK_RATE = 0.8;
const FULL_BONUS = 1 / CLICK_RATE - 1;
// the extra tenth on top of every take, spendable only on the current pick
const CREDIT_SHARE = 0.1;
// a bonus stops paying a pot's worth of time after the take that last added to it, so every
// fill of the jar comes with a game to play before the next one
const CREDIT_TTL_MS = CYCLE_MS;
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
const readKey = (bag, key) => (bag ? (typeof bag.get === "function" ? bag.get(key) : bag[key]) : undefined);

const entriesOf = (bag) => {
  if (!bag) return [];
  return typeof bag.entries === "function" && !Array.isArray(bag) ? [...bag.entries()] : Object.entries(bag);
};

const stamp = (iso) => (iso ? Date.parse(iso) : 0);

const creditHeld = (user, game) => Number(readKey(user && user.gameCredits, game)) || 0;

const creditExpiry = (user, game) => {
  const at = readKey(user && user.gameCreditsExpireAt, game);
  return at ? new Date(at) : null;
};

// what a bet can spend right now. credit with no clock predates the rule, so it counts as expired
const creditLive = (user, game, now = new Date()) => {
  const at = creditExpiry(user, game);
  return at && at.getTime() > now.getTime() ? creditHeld(user, game) : 0;
};

// every game holding credit, live ones first and the freshest of those first. an expired one
// stays listed until the next take burns it, so the dock can show that it went
const bonusesOf = (user, now = new Date()) =>
  entriesOf(user && user.gameCredits)
    .filter(([, held]) => Number(held) > 0)
    .map(([game, held]) => {
      const at = creditExpiry(user, game);
      return { game, amount: Number(held), expiresAt: at ? at.toISOString() : null, expired: !at || at.getTime() <= now.getTime() };
    })
    .sort((a, b) => Number(a.expired) - Number(b.expired) || stamp(b.expiresAt) - stamp(a.expiresAt));

const expiredCredits = (user, now = new Date()) => bonusesOf(user, now).filter((b) => b.expired);

module.exports = {
  CYCLE_MS,
  MIN_CLAIM,
  CLICK_RATE,
  FULL_BONUS,
  CREDIT_SHARE,
  CREDIT_TTL_MS,
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
  creditExpiry,
  creditLive,
  bonusesOf,
  expiredCredits,
};
