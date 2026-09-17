import api from "../api";

export type MatchStatus = "CORRECT" | "WRONG" | "HIGHER" | "LOWER";

export type MatchKey =
  | "academy"
  | "role"
  | "type"
  | "rarity"
  | "attackType"
  | "defenseType"
  | "height"
  | "age"
  | "schoolYear";

export interface HaloStudent {
  name: string;
  rarity: number;
  type: string;
  role: string;
  attackType: string;
  defenseType: string;
  academy: string;
  schoolYear: string;
  age: string;
  height: number;
  studentImage: string;
}

export interface GuessRow {
  student: HaloStudent;
  correct: boolean;
  matches: Record<MatchKey, MatchStatus>;
}

export type HintKey = "halo" | "hobby" | "weapon" | "profile" | "gear" | "voice" | "club";

export interface Hint {
  key: HintKey;
  unlockAt: number;
  unlocked: boolean;
  available: boolean;
  image?: string;
  text?: string | null;
  birthday?: string;
  audio?: string;
}

export interface HaloCard {
  itemId: string;
  name: string;
  image: string;
  rarity: string;
  caseId: string;
  caseSlug: string | null;
  caseTitle: string;
  caseImage: string | null;
}

export interface HaloAnswer {
  name: string;
  academy: string;
  rarity: number;
  type: string;
  role: string;
  studentImage: string;
  voiceline: string;
  haloImage: string;
  card: HaloCard | null;
}

export interface HaloPlay {
  guesses: GuessRow[];
  won: boolean;
  lost: boolean;
  finished: boolean;
  hints: Hint[];
  answer: HaloAnswer | null;
  reward: number;
  adopted: boolean;
}

export interface HaloStats {
  played: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  distribution: number[];
}

export interface HaloReward {
  base: number;
  perSpareGuess: number;
  streakBonus: number;
  streakBonusCap: number;
  best: number;
}

export interface HaloToday {
  day: number;
  number: number;
  nextAt: string;
  maxGuesses: number;
  poolSize: number;
  reward: HaloReward;
  plays: number;
  solves: number;
  averageGuesses: number | null;
  yesterday: { name: string; academy: string; studentImage: string } | null;
  signedIn: boolean;
  play: HaloPlay | null;
  stats: HaloStats | null;
}

export interface HaloTurn {
  play: HaloPlay;
  stats: HaloStats;
}

export async function getHaloStudents(): Promise<HaloStudent[]> {
  const res = await api.get("/arcade/daily-halo/students");
  return res.data;
}

export async function getHaloToday(): Promise<HaloToday> {
  const res = await api.get("/arcade/daily-halo/today");
  return res.data;
}

export async function checkGuestGuesses(guesses: string[]): Promise<HaloPlay> {
  const res = await api.post("/arcade/daily-halo/check", { guesses });
  return res.data.play;
}

export async function submitHaloGuess(name: string): Promise<HaloTurn & { accepted: boolean }> {
  const res = await api.post("/arcade/daily-halo/guess", { name });
  return res.data;
}

export async function adoptGuestGame(guesses: string[]): Promise<HaloTurn & { adopted: boolean }> {
  const res = await api.post("/arcade/daily-halo/adopt", { guesses });
  return res.data;
}
