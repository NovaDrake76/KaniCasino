// the daily gift. the player picks a category, spins once, and wins free openings of a
// specific case from that category. picking your own franchise has to cost you nothing,
// so every category's table is built to roughly the same expected value: cheap
// categories pay it as volume, expensive ones as rarity.
//
// see .docs/retention.md for the churn numbers this exists to move.

const GIFT_ALGO_VERSION = 1;

// no case dearer than this is ever in a table. counter-strike runs to 1,324,450 KP and
// the median player holds 175, so a grail drop would be an economy event, not a reward.
const MAX_CASE_PRICE = 2000;

// no single prize hands over more than this many openings, whatever the arithmetic says.
// it has to clear the dearest slot divided by the cheapest category's case price, or the
// top slots collapse into each other and the jackpot stops being one.
const MAX_OPENS = 99;

// the six slots, cheapest to rarest. `target` is the KP the slot aims to be worth and
// `weight` its share of the roll space; together they set the expected value per spin.
const SLOTS = [
  { target: 200, weight: 40 },
  { target: 400, weight: 27 },
  { target: 800, weight: 18 },
  { target: 1400, weight: 9 },
  { target: 2000, weight: 5 },
  { target: 2500, weight: 1 },
];

// the second stage. after the reel lands, this multiplies what it gave. the two levers
// do deliberately different jobs: the streak decides how OFTEN it fires, the level
// decides how HIGH it can go. a locked tier a player can see beats a hidden advantage,
// which is why level gates whole multipliers rather than nudging odds.
const TOP_SLOT = [
  { multiplier: 1, weight: 60, minLevel: 0 },
  { multiplier: 2, weight: 25, minLevel: 0 },
  { multiplier: 3, weight: 10, minLevel: 10 },
  { multiplier: 5, weight: 4, minLevel: 30 },
  { multiplier: 10, weight: 1, minLevel: 60 },
  // the billboard rung. two accounts have ever passed level 100, and at this weight it
  // lands roughly never, which is the point: it is there to be seen, not won
  { multiplier: 25, weight: 0.3, minLevel: 100 },
];

// the gift runs on a fixed daily boundary rather than a rolling 24h cooldown. a rolling
// one drifts: every spin sets the next window to whenever the last one landed, so a player
// who spins a little later each day walks their slot around the clock until it lands on a
// time they are never online, and the streak dies on a day they did turn up.
const RESET_HOUR_UTC = 6;
// a grant dies with the day it was won, which is the whole reason to come back tomorrow
const GRANT_TTL_MS = 24 * 60 * 60 * 1000;

// which site-day an instant falls in. one definition for the cooldown and for the streak,
// which is what stops the two from disagreeing.
const dayIndex = (at) =>
  Math.floor((new Date(at).getTime() - RESET_HOUR_UTC * 3600000) / 86400000);

const nextResetAt = (from = new Date()) =>
  new Date((dayIndex(from) + 1) * 86400000 + RESET_HOUR_UTC * 3600000);

// a streak shifts weight toward the better slots. it never raises what a slot is worth:
// a growing ceiling turns the daily into a power-up and the economy wears it.
const STREAK_STEP = 0.06;
const MAX_STREAK_TILT = 0.6;

const streakTilt = (streak) => Math.min((streak || 0) * STREAK_STEP, MAX_STREAK_TILT);

const eligible = (cases) =>
  cases
    .filter((c) => Number.isFinite(c.price) && c.price > 0 && c.price <= MAX_CASE_PRICE)
    .sort((a, b) => a.price - b.price);

// walk the category's cases from cheapest to dearest as the slots get rarer, so a table
// shows off the whole category instead of naming the same case six times
function caseForSlot(sorted, slotIndex, slotCount) {
  if (sorted.length === 1) return sorted[0];
  const span = (slotIndex * (sorted.length - 1)) / (slotCount - 1);
  return sorted[Math.min(sorted.length - 1, Math.floor(span))];
}

// a rarer slot has to be worth more than the one below it, or there is nothing to
// almost hit. rounding can invert them: a dear case at one opening can come to less
// than a cheaper case at several, so the order is repaired rather than hoped for.
function enforceRising(table) {
  for (let i = 1; i < table.length; i++) {
    const prev = table[i - 1];
    const cur = table[i];
    if (cur.value > prev.value) continue;

    const needed = Math.floor(prev.value / cur.price) + 1;
    if (needed <= MAX_OPENS) {
      cur.opens = needed;
    } else {
      // this case cannot outgrow the slot below even at the cap, so carry the cheaper
      // one up and pay an extra opening instead
      Object.assign(cur, { caseId: prev.caseId, title: prev.title, image: prev.image, price: prev.price });
      cur.opens = Math.min(MAX_OPENS, prev.opens + 1);
    }
    cur.value = cur.price * cur.opens;
  }
  return table;
}

// build one category's prize table. every slot names a case and how many free openings
// of it the player wins.
function tableFor(cases) {
  const sorted = eligible(cases);
  if (!sorted.length) return [];

  const table = SLOTS.map((slot, i) => {
    const picked = caseForSlot(sorted, i, SLOTS.length);
    const opens = Math.max(1, Math.min(MAX_OPENS, Math.round(slot.target / picked.price)));
    return {
      caseId: String(picked._id),
      title: picked.title,
      image: picked.image,
      price: picked.price,
      opens,
      value: picked.price * opens,
      weight: slot.weight,
    };
  });

  return enforceRising(table);
}

// what a spin is worth on average, which is the number that has to stay comparable
// across categories or the choice is theatre
function expectedValue(table, streak = 0) {
  const w = weightsFor(table, streak);
  const total = w.reduce((a, b) => a + b, 0);
  return total ? table.reduce((sum, s, i) => sum + (w[i] / total) * s.value, 0) : 0;
}

// the streak leaves the cheap slots alone and lifts the rare ones
function weightsFor(table, streak = 0) {
  const tilt = streakTilt(streak);
  const last = table.length - 1;
  return table.map((s, i) => {
    const rank = last ? i / last : 0; // 0 for the commonest slot, 1 for the rarest
    return s.weight * (1 + tilt * rank * 2);
  });
}

// the whole wheel, with the rungs the player has not earned marked rather than hidden:
// seeing 10x locked behind level 60 is the reason to keep levelling
function topSlotFor(level = 0) {
  return TOP_SLOT.map((t) => ({ ...t, locked: (level || 0) < t.minLevel }));
}

// the streak lifts every multiplier above 1x, so the odds of landing on nothing fall
function topSlotWeights(wheel, streak = 0) {
  const tilt = streakTilt(streak);
  const live = wheel.filter((t) => !t.locked);
  const last = live.length - 1;
  return wheel.map((t) => {
    if (t.locked) return 0;
    const rank = last ? live.indexOf(t) / last : 0;
    return t.weight * (1 + tilt * rank * 2);
  });
}

function pickTopSlot(wheel, rollValue, total, streak = 0) {
  const w = topSlotWeights(wheel, streak);
  const sum = w.reduce((a, b) => a + b, 0);
  if (!sum) return wheel[0];
  const scaled = ((rollValue - 1) / total) * sum;
  let acc = 0;
  for (let i = 0; i < wheel.length; i++) {
    acc += w[i];
    if (w[i] > 0 && scaled < acc) return wheel[i];
  }
  return wheel.find((t) => !t.locked) || wheel[0];
}

// what the top slot multiplies the reel by on average, for the copy and the tests
function topSlotAverage(level = 0, streak = 0) {
  const wheel = topSlotFor(level);
  const w = topSlotWeights(wheel, streak);
  const sum = w.reduce((a, b) => a + b, 0);
  return sum ? wheel.reduce((acc, t, i) => acc + (w[i] / sum) * t.multiplier, 0) : 1;
}

// the most a single day can ever pay: the best reel prize times the best multiplier.
// bounded on purpose, so nobody wakes up a millionaire.
function ceilingFor(table, level = 0) {
  if (!table.length) return 0;
  const best = Math.max(...table.map((s) => s.value));
  const wheel = topSlotFor(level).filter((t) => !t.locked);
  return best * Math.max(...wheel.map((t) => t.multiplier));
}

// maps a roll in 1..total onto the weighted table
function pickSlot(table, rollValue, total, streak = 0) {
  const w = weightsFor(table, streak);
  const sum = w.reduce((a, b) => a + b, 0);
  const scaled = ((rollValue - 1) / total) * sum;
  let acc = 0;
  for (let i = 0; i < table.length; i++) {
    acc += w[i];
    if (scaled < acc) return table[i];
  }
  return table[table.length - 1];
}

// consecutive-day counter on the same site-day the cooldown uses, so a spin taken any
// time within a day counts once and the day after always reads as the next one
function nextStreak(streak, lastAt, now = new Date()) {
  if (!lastAt) return 1;
  const gap = dayIndex(now) - dayIndex(lastAt);
  if (gap <= 0) return streak || 1;
  if (gap === 1) return (streak || 0) + 1;
  return 1;
}

const claimableAt = (last) => (last ? nextResetAt(last) : null);
const isClaimable = (last, now = new Date()) => {
  const at = claimableAt(last);
  return !at || at <= now;
};

module.exports = {
  GIFT_ALGO_VERSION,
  TOP_SLOT,
  topSlotFor,
  topSlotWeights,
  pickTopSlot,
  topSlotAverage,
  ceilingFor,
  MAX_CASE_PRICE,
  MAX_OPENS,
  SLOTS,
  RESET_HOUR_UTC,
  GRANT_TTL_MS,
  dayIndex,
  nextResetAt,
  STREAK_STEP,
  MAX_STREAK_TILT,
  streakTilt,
  eligible,
  caseForSlot,
  enforceRising,
  tableFor,
  expectedValue,
  weightsFor,
  pickSlot,
  nextStreak,
  claimableAt,
  isClaimable,
};
