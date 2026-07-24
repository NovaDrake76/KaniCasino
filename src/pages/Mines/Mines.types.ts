import { useMinesServices } from "./Mines.services";

export interface MinesGameState {
  gameId: string;
  status: "active" | "cashed" | "busted" | "voided";
  actionSeq: number;
  betAmount: number;
  mineCount: number;
  revealed: number[];
  gems: number;
  multiplier: number;
  nextMultiplier: number | null;
  canCashout: boolean;
  mineSet: number[] | null;
  bustTile: number | null;
  payout: number;
  rollId: string | null;
}

export type MinesViewProps = ReturnType<typeof useMinesServices>;
