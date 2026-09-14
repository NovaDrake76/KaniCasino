import api from "../api";

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
  return res.data;
}

export type TourStatus = "offered" | "active" | "skipped" | "done";
export type TourStep = "pot" | "case" | "open" | "drop" | "game" | "bet" | "play" | "done";

export async function saveTour(status: TourStatus, step?: TourStep): Promise<void> {
  await api.post("/daisu/tour", { status, step });
}

export async function claimPot(): Promise<PotClaim> {
  const res = await api.post("/daisu/claim");
  return res.data;
}
