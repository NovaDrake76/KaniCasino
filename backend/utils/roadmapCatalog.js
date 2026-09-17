// daisu's missions for the beta: chapters of four, opened one at a time. an activity goal counts
// only what happened since its chapter opened; a state goal reads the account as it stands
const CHAPTERS = [
  {
    chapter: 1,
    bonus: 1000,
    missions: [
      { key: "r1-full-pot", goal: "fullPots", target: 1, reward: 250 },
      { key: "r1-pin", goal: "pinned", target: 1, reward: 300 },
      { key: "r1-bonus", goal: "bonusSpent", target: 1, reward: 300 },
      { key: "r1-level", goal: "level", target: 5, reward: 500 },
    ],
  },
  {
    chapter: 2,
    bonus: 2000,
    missions: [
      { key: "r2-gift", goal: "giftSpins", target: 1, reward: 500 },
      { key: "r2-sell", goal: "itemsSold", target: 1, reward: 300 },
      { key: "r2-games", goal: "gamesTried", target: 3, reward: 600 },
      { key: "r2-level", goal: "level", target: 10, reward: 1000 },
    ],
  },
  {
    chapter: 3,
    bonus: 4000,
    missions: [
      { key: "r3-streak", goal: "giftStreak", target: 3, reward: 1500 },
      { key: "r3-market", goal: "marketTrades", target: 1, reward: 1500 },
      { key: "r3-collection", goal: "collectionVisits", target: 1, reward: 1000 },
      { key: "r3-cases", goal: "casesOpened", target: 25, reward: 2000 },
    ],
  },
  {
    chapter: 4,
    bonus: 8000,
    missions: [
      { key: "r4-streak", goal: "giftStreak", target: 7, reward: 4000 },
      { key: "r4-collection", goal: "collectionsCompleted", target: 1, reward: 5000 },
      { key: "r4-level", goal: "level", target: 20, reward: 3000 },
      { key: "r4-stake", goal: "staked", target: 50000, reward: 5000 },
    ],
  },
  {
    chapter: 5,
    bonus: 20000,
    missions: [
      { key: "r5-level", goal: "level", target: 30, reward: 6000 },
      { key: "r5-battle", goal: "battlesWon", target: 1, reward: 5000 },
      { key: "r5-top-fan", goal: "topFan", target: 1, reward: 10000 },
      { key: "r5-stake", goal: "staked", target: 500000, reward: 15000 },
    ],
  },
];

const chapterOf = (n) => CHAPTERS.find((c) => c.chapter === n) || null;

module.exports = { CHAPTERS, chapterOf };
