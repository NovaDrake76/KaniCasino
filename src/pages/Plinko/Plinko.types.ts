import { usePlinkoServices } from "./Plinko.services";
import { PlinkoRisk } from "./plinkoBoard";

export interface PlinkoDropResult {
  betAmount: number;
  risk: PlinkoRisk;
  path: string;
  bin: number;
  multiplier: number;
  payout: number;
  rollId: string | null;
}

export interface PlinkoBall extends PlinkoDropResult {
  key: string;
}

export type PlinkoViewProps = ReturnType<typeof usePlinkoServices>;
