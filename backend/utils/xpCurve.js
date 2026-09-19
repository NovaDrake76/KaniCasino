// the level ladder. a bet earns XP_PER_KP per K₽ staked, times the account's boost, and a level is
// reached at a total of xp. the ladder is an anchor table: K₽ wagered to reach a level, unboosted,
// log-linear between anchors and continued at the last slope past the end, so each anchor is a knob
const XP_PER_KP = 5;
const ANCHORS = [
  [1, 40],
  [5, 2500],
  [10, 9000],
  [20, 90000],
  [30, 800000],
  [50, 20000000],
  [75, 300000000],
  [100, 3000000000],
];

const kpForLevel = (level) => {
  if (level < 1) return 0;
  for (let i = 0; i + 1 < ANCHORS.length; i++) {
    const [l0, k0] = ANCHORS[i];
    const [l1, k1] = ANCHORS[i + 1];
    if (level <= l1) return Math.exp(Math.log(k0) + ((level - l0) / (l1 - l0)) * (Math.log(k1) - Math.log(k0)));
  }
  const [l0, k0] = ANCHORS[ANCHORS.length - 2];
  const [l1, k1] = ANCHORS[ANCHORS.length - 1];
  return Math.exp(Math.log(k1) + ((level - l1) * (Math.log(k1) - Math.log(k0))) / (l1 - l0));
};

const xpForLevel = (level) => Math.floor(kpForLevel(level) * XP_PER_KP);

// level is fully derived from xp, so this is idempotent and safe to recompute
const levelFromXp = (xp) => {
  let level = 0;
  while ((xp || 0) >= xpForLevel(level + 1)) level += 1;
  return level;
};

// the ladder before 2026-09: a quarter more xp per level, kept only to carry accounts over
const OLD_BASE_XP = 1000;
const OLD_GROWTH_RATE = 1.25;
const oldXpForLevel = (level) => (level < 1 ? 0 : Math.floor(OLD_BASE_XP * Math.pow(OLD_GROWTH_RATE, level - 1)));
const oldLevelFromXp = (xp) => {
  let level = 0;
  while ((xp || 0) >= oldXpForLevel(level + 1)) level += 1;
  return level;
};

// the bet types that earn xp, and the game a charm from daisu's shop names for each
const XP_GAME_OF_BET = {
  slot_bet: "slots",
  dice_bet: "dice",
  plinko_bet: "plinko",
  mines_bet: "mines",
  blackjack_bet: "blackjack",
  hilo_bet: "hilo",
  crash_bet: "crash",
  coinflip_bet: "coinflip",
  case_open: "cases",
  battle_entry: "battles",
};

// the account's multiplier on a game: its global boosts plus the charm of that game, both from the shop
const xpMultiplier = (xpBoost, game) => {
  const all = Number(xpBoost && xpBoost.all) || 1;
  const charm = (game && Number(xpBoost && xpBoost[game])) || 0;
  return all + charm;
};

const xpGain = (cost, game, xpBoost) => Math.round(cost * XP_PER_KP * xpMultiplier(xpBoost, game));

// the same multiplier as a mongo expression, so a charge can apply it inside its own write
const xpGainExpr = (cost, game) => ({
  $round: [
    {
      $multiply: [
        cost * XP_PER_KP,
        { $add: [{ $ifNull: ["$xpBoost.all", 1] }, game ? { $ifNull: [`$xpBoost.${game}`, 0] } : 0] },
      ],
    },
    0,
  ],
});

module.exports = { XP_PER_KP, ANCHORS, kpForLevel, xpForLevel, levelFromXp, oldXpForLevel, oldLevelFromXp, XP_GAME_OF_BET, xpMultiplier, xpGain, xpGainExpr };
