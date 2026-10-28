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
  | "discordLinked"
  | "daysPlayed"
  | "bigWin"
  | "rainsCaught"
  | "referrals"
  | "predictions"
  | "rounds";

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

// a daily request is a mission like any other; the rounds ones name the game they are for
export interface DailyMission extends RoadmapMission {
  game: string | null;
}

export interface Daily {
  day: string;
  resetsAt: string;
  missions: DailyMission[];
}

export interface Roadmap {
  chapter: number;
  chapters: number;
  finished: boolean;
  bonus: number;
  missions: RoadmapMission[];
  next: RoadmapPreview | null;
  daily?: Daily;
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

export interface DailyClaim {
  claimed: boolean;
  alreadyClaimed?: boolean;
  reward?: number;
  walletBalance?: number;
  daily: Daily;
}

export async function claimDailyMission(key: string): Promise<DailyClaim> {
  const res = await api.post(`/daisu/missions/daily/${key}/claim`);
  return res.data;
}

// only the page that shows a thing knows it was looked at, so the page tells her
export async function visitRoadmapGoal(goal: "collectionVisits"): Promise<void> {
  await api.post("/daisu/missions/visit", { goal });
}
