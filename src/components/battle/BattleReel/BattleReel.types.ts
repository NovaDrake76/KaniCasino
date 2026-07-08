import { BattleItem } from "../../../services/battles/BattleService";
import { useBattleReel } from "./BattleReel.services";

export interface BattleReelProps {
  pool: BattleItem[];
  winner: BattleItem;
  durationMs: number;
}

export type BattleReelViewProps = ReturnType<typeof useBattleReel>;
