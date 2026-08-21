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
  game: "case" | "upgrade" | "slots" | "battle" | "plinko" | "blackjack" | "dice" | "mines" | "hilo";
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
  recomputedPlayerCards?: number[];
  recomputedDealerCards?: number[];
  recomputedDealerTotal?: number;
  recomputedOutcome?: string;
  recomputedPayout?: number;
  recomputedResult?: number;
  recomputedWon?: boolean;
  expectedResult?: number;
  expectedWon?: boolean;
  expectedPayout?: number;
  recomputedMineSet?: number[];
  recomputedGems?: number;
  recomputedBusted?: boolean;
  recomputedCards?: string[];
  recomputedGuesses?: number;
}

export interface PokerVerify {
  tableId?: string;
  handNumber: number;
  revealed: boolean;
  algoVersion?: number;
  currentAlgoVersion?: number;
  serverSeed?: string;
  serverSeedHash: string | null;
  combinedClientSeed?: string;
  commitmentValid?: boolean;
  board?: string[];
  recomputedBoard?: string[];
  boardValid?: boolean;
  players?: {
    seat: number;
    username: string;
    holeCards: string[];
    recomputed: string[];
    matches: boolean;
    wonChips: number;
    folded: boolean;
  }[];
  outcomeValid?: boolean;
  rake?: number;
}

// a poker hand is verified as a whole rather than as one player's roll: the deal is keyed
// by every seated player's client seed, so there is no single roll to look up
export const verifyPokerHand = (tableId: string, handNumber: number) =>
  api.get<PokerVerify>(`/fair/poker/${tableId}/${handNumber}`).then((r) => r.data);

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
