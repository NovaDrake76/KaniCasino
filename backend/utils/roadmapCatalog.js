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
  // from here the chapters are the long game: each level target is a long stretch of play on the
  // xp curve, and the other three missions of a chapter stay reachable in weeks so there is always
  // something to claim while the level comes
  {
    chapter: 6,
    bonus: 40000,
    missions: [
      { key: "r6-days", goal: "daysPlayed", target: 14, reward: 10000 },
      { key: "r6-full-pots", goal: "fullPots", target: 30, reward: 8000 },
      { key: "r6-collections", goal: "collectionsCompleted", target: 3, reward: 15000 },
      { key: "r6-level", goal: "level", target: 40, reward: 20000 },
    ],
  },
  {
    chapter: 7,
    bonus: 80000,
    missions: [
      { key: "r7-stake", goal: "staked", target: 5000000, reward: 30000 },
      { key: "r7-big-win", goal: "bigWin", target: 100000, reward: 25000 },
      { key: "r7-market", goal: "marketTrades", target: 25, reward: 20000 },
      { key: "r7-level", goal: "level", target: 50, reward: 40000 },
    ],
  },
  {
    chapter: 8,
    bonus: 160000,
    missions: [
      { key: "r8-rain", goal: "rainsCaught", target: 10, reward: 30000 },
      { key: "r8-battles", goal: "battlesWon", target: 10, reward: 40000 },
      { key: "r8-streak", goal: "giftStreak", target: 30, reward: 50000 },
      { key: "r8-level", goal: "level", target: 60, reward: 80000 },
    ],
  },
  {
    chapter: 9,
    bonus: 320000,
    missions: [
      { key: "r9-days", goal: "daysPlayed", target: 60, reward: 80000 },
      { key: "r9-cases", goal: "casesOpened", target: 1000, reward: 80000 },
      { key: "r9-collections", goal: "collectionsCompleted", target: 10, reward: 120000 },
      { key: "r9-level", goal: "level", target: 75, reward: 160000 },
    ],
  },
  {
    chapter: 10,
    bonus: 1000000,
    missions: [
      { key: "r10-stake", goal: "staked", target: 100000000, reward: 250000 },
      { key: "r10-referrals", goal: "referrals", target: 5, reward: 250000 },
      { key: "r10-predictions", goal: "predictions", target: 25, reward: 150000 },
      { key: "r10-level", goal: "level", target: 100, reward: 1000000 },
    ],
  },
];

const chapterOf = (n) => CHAPTERS.find((c) => c.chapter === n) || null;

module.exports = { CHAPTERS, chapterOf };
