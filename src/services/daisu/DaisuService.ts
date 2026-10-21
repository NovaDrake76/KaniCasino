import api from "../api";
import { noteServerTime } from "../serverClock";

export type PickGame = "slots" | "dice" | "plinko" | "mines" | "blackjack" | "hilo";

// the extra tenth of a take, spendable on one game until its clock runs out
export interface PotBonus {
  game: PickGame;
  amount: number;
  expiresAt: string | null;
  expired: boolean;
}

export interface PotStatus {
  fill: number;
  full: number;
  amount: number;
  fullAt: string;
  cycleMs: number;
  clickRate: number;
  fullBonus: number;
  creditShare: number;
  pick: PickGame;
  nextPick: PickGame;
  pickProgress: number;
  creditTtlMs: number;
  bonuses: PotBonus[];
  serverTime?: string;
}

export interface PotClaim {
  amount: number;
  credit: number;
  pick: PickGame;
  fill: number;
  pickChanged: boolean;
  walletBalance: number;
  nextBonus: string;
  status: PotStatus;
}

export async function getPotStatus(): Promise<PotStatus> {
  const res = await api.get("/daisu/status");
  noteServerTime(res.data?.serverTime);
  return res.data;
}

export type TourStatus = "offered" | "active" | "skipped" | "done";
export type TourStep = "pot" | "case" | "open" | "drop" | "game" | "bet" | "range" | "play" | "done";

// a replay is the footer asking for the tour again, which the server takes from a finished or skipped one
export async function saveTour(status: TourStatus, step?: TourStep, replay?: boolean): Promise<void> {
  await api.post("/daisu/tour", { status, step, replay });
}

export async function claimPot(): Promise<PotClaim> {
  const res = await api.post("/daisu/claim");
  noteServerTime(res.data?.status?.serverTime);
  return res.data;
}
