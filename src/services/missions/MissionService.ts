import api from "../api";

export interface Mission {
  key: string;
  title: string;
  description: string;
  category: string;
  reward: number;
  social: "discord" | "x" | null;
  target: number;
  current: number;
  complete: boolean;
  claimed: boolean;
  claimable: boolean;
}

export interface MissionsData {
  missions: Mission[];
  totals: { total: number; completed: number; claimable: number; claimed: number };
}

export interface PendingMission {
  key: string;
  title: string;
  reward: number;
}

export interface ClaimResult {
  claimed: boolean;
  alreadyClaimed?: boolean;
  reward?: number;
  walletBalance?: number;
  missionKey?: string;
}

export async function getMissions(): Promise<MissionsData> {
  const res = await api.get("/missions");
  return res.data;
}

// missions newly complete since the last check, for the "mission complete" toast.
// pass light=true on frequent calls (balance changes) to skip the heavy collection scan.
export async function getPendingMissions(light: boolean): Promise<PendingMission[]> {
  // a timeout guarantees the promise settles, so the caller's in-flight guard can
  // never stay pinned by a stalled connection
  const res = await api.get(`/missions/pending${light ? "?light=1" : ""}`, { timeout: 10000 });
  return res.data.pending || [];
}

export async function visitMission(key: string): Promise<void> {
  await api.post(`/missions/${key}/visit`);
}

export async function claimMission(key: string): Promise<ClaimResult> {
  const res = await api.post(`/missions/${key}/claim`);
  return res.data;
}
