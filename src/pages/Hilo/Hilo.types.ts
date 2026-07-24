import { useHiloServices } from "./Hilo.services";

export interface HiloGameState {
  gameId: string;
  status: "active" | "cashed" | "busted" | "voided";
  actionSeq: number;
  betAmount: number;
  cards: number[];
  multiplier: number;
  guesses: number;
  skips: number;
  current: number;
  hiChance?: number;
  loChance?: number;
  hiMultiplier?: number;
  loMultiplier?: number;
  canCashout: boolean;
  canSkip: boolean;
  payout: number;
  rollId: string | null;
}

export type HiloViewProps = ReturnType<typeof useHiloServices>;
