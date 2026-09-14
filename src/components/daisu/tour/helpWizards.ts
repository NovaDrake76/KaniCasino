export type Wizard = "pot" | "pin" | "sell" | "bonus" | "games" | "gift" | "market" | "collection" | "cases" | "battle" | "fans";

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
};

export const wizardFor = (goal: string | null): Wizard | null => (goal && BY_GOAL[goal]) || null;
