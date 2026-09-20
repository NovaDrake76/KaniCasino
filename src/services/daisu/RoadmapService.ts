import api from "../api";

// one of her missions finished somewhere else, so whatever shows them should read them again
export const ROADMAP_CHANGED_EVENT = "daisu:missions-changed";

export type RoadmapGoal =
  | "fullPots"
  | "pinned"
  | "bonusSpent"
  | "level"
  | "giftSpins"
  | "itemsSold"
  | "gamesTried"
  | "giftStreak"
  | "marketTrades"
  | "collectionVisits"
  | "casesOpened"
  | "collectionsCompleted"
  | "staked"
  | "battlesWon"
  | "topFan"
  | "discordLinked";

export interface RoadmapMission {
  key: string;
  goal: RoadmapGoal;
  target: number;
  reward: number;
  current: number;
  complete: boolean;
  claimed: boolean;
  claimable: boolean;
}

export interface RoadmapPreview {
  chapter: number;
  bonus: number;
  missions: Pick<RoadmapMission, "key" | "goal" | "target" | "reward">[];
}

export interface Roadmap {
  chapter: number;
  chapters: number;
  finished: boolean;
  bonus: number;
  missions: RoadmapMission[];
  next: RoadmapPreview | null;
}

export interface RoadmapClaim {
  claimed: boolean;
  alreadyClaimed?: boolean;
  reward?: number;
  walletBalance?: number;
  chapterDone?: { chapter: number; bonus: number } | null;
  roadmap: Roadmap;
}

export async function getRoadmap(): Promise<Roadmap> {
  const res = await api.get("/daisu/missions");
  return res.data;
}

export async function claimRoadmapMission(key: string): Promise<RoadmapClaim> {
  const res = await api.post(`/daisu/missions/${key}/claim`);
  return res.data;
}

// only the page that shows a thing knows it was looked at, so the page tells her
export async function visitRoadmapGoal(goal: "collectionVisits"): Promise<void> {
  await api.post("/daisu/missions/visit", { goal });
}
