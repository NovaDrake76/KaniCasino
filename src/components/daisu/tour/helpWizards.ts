export type Wizard =
  | "pot"
  | "pin"
  | "sell"
  | "bonus"
  | "games"
  | "gift"
  | "market"
  | "collection"
  | "cases"
  | "battle"
  | "fans"
  | "predictions"
  | "affiliates"
  | "chat";

// how she shows each kind of mission: where it happens and what to point at once there
const BY_GOAL: Record<string, Wizard> = {
  fullPots: "pot",
  pinned: "pin",
  bonusSpent: "bonus",
  level: "games",
  gamesTried: "games",
  staked: "games",
  giftSpins: "gift",
  giftStreak: "gift",
  itemsSold: "sell",
  marketTrades: "market",
  collectionVisits: "collection",
  collectionsCompleted: "collection",
  casesOpened: "cases",
  battlesWon: "battle",
  topFan: "fans",
  // what an item from her shop opened, shown right after it is bought
  "unlock:collectionBook": "collection",
  "unlock:tradersLicense": "market",
  "unlock:predictionPass": "predictions",
  "unlock:chatPass": "chat",
  "unlock:affiliateCard": "affiliates",
  "unlock:giftCharm": "gift",
  "unlock:merchantSeal": "market",
};

export const wizardFor = (goal: string | null): Wizard | null => (goal && BY_GOAL[goal]) || null;
