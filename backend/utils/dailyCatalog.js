// daisu's daily requests: one from each slot, the same three for every player, new at 00:00 utc. a slot turns by the day, so
// nothing comes back the next day; rewards are a level 0 player's, and scaleTarget marks a K₽ goal that grows with the level
const SLOTS = [
  [
    { key: "full-pot", goal: "fullPots", target: 1, reward: 300 },
    { key: "cases", goal: "casesOpened", target: 3, reward: 300 },
    { key: "gift", goal: "giftSpins", target: 1, reward: 300 },
    { key: "bonus", goal: "bonusSpent", target: 1, reward: 300 },
  ],
  [
    { key: "dice", goal: "rounds", game: "dice", target: 25, reward: 500 },
    { key: "mines", goal: "rounds", game: "mines", target: 10, reward: 500 },
    { key: "crash", goal: "rounds", game: "crash", target: 5, reward: 500 },
    { key: "plinko", goal: "rounds", game: "plinko", target: 25, reward: 500 },
    { key: "blackjack", goal: "rounds", game: "blackjack", target: 10, reward: 500 },
    { key: "coinflip", goal: "rounds", game: "coinflip", target: 5, reward: 500 },
    { key: "slots", goal: "rounds", game: "slots", target: 25, reward: 500 },
    { key: "hilo", goal: "rounds", game: "hilo", target: 10, reward: 500 },
  ],
  [
    { key: "stake", goal: "staked", target: 10000, reward: 750, scaleTarget: true },
    { key: "games", goal: "gamesTried", target: 3, reward: 750 },
  ],
];

const DAY_MS = 24 * 60 * 60 * 1000;

const dayOf = (at = new Date()) => Math.floor(new Date(at).getTime() / DAY_MS);

const missionsOn = (day) => SLOTS.map((slot) => slot[day % slot.length]);

// the pot's own multiplier, 1 + level / 10, so a request is worth the same number of the player's own full pots at every level
const scaled = (base, level) => Math.round((base * (10 + Math.max(0, Math.floor(level || 0)))) / 10);

// a request as one player sees it on a day pinned to this level
const sizedFor = (mission, level) => ({
  ...mission,
  reward: scaled(mission.reward, level),
  target: mission.scaleTarget ? scaled(mission.target, level) : mission.target,
});

module.exports = { SLOTS, DAY_MS, dayOf, missionsOn, scaled, sizedFor };
