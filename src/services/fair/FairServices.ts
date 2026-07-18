import api from "../api";

export interface SeedState {
  clientSeed: string;
  serverSeedHash: string;
  nonce: number;
}

export interface RevealedSeed {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface RollRange {
  itemId: string;
  rarity: string;
  start: number;
  end: number;
}

export interface RollView {
  rollId: string;
  game: "case" | "upgrade" | "slots" | "battle" | "plinko";
  clientSeed: string;
  serverSeedHash: string;
  serverSeed: string | null;
  nonce: number;
  cursor: number;
  roll: number;
  total: number;
  createdAt: string;
  caseId?: string;
  itemId?: string;
  caseConfigVersion?: number;
  caseConfigHash?: string;
  rangeTable?: RollRange[];
  outcome?: unknown;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  recomputedRoll?: number;
  expectedRoll?: number;
  expectedItemId?: string;
  pickedItemId?: string;
  recomputedPath?: string;
  recomputedBin?: number;
  recomputedMultiplier?: number;
  expectedPath?: string;
  expectedBin?: number;
  expectedMultiplier?: number;
}

export const getSeed = () => api.get<SeedState>("/fair/seed").then((r) => r.data);

export const setClientSeed = (clientSeed: string) =>
  api.post<SeedState>("/fair/client-seed", { clientSeed }).then((r) => r.data);

export const rotateSeed = (clientSeed?: string) =>
  api
    .post<{ revealed: RevealedSeed | null; current: SeedState }>(
      "/fair/rotate",
      clientSeed ? { clientSeed } : {}
    )
    .then((r) => r.data);

export const getRoll = (rollId: string) =>
  api.get<RollView>(`/fair/roll/${rollId}`).then((r) => r.data);

export const getRollByItem = (uniqueId: string) =>
  api.get<RollView>(`/fair/roll-by-item/${uniqueId}`).then((r) => r.data);

export const verifyRoll = (rollId: string) =>
  api.get<VerifyResult>(`/fair/roll/${rollId}/verify`).then((r) => r.data);
