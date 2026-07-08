import { BattlePlayer } from "../../../services/battles/BattleService";
import { useTieBreaker } from "./TieBreaker.services";

export interface TieBreakerProps {
  players: BattlePlayer[]; // the tied players
  winner: BattlePlayer; // the player the reel lands on
  durationMs: number;
}

export type TieBreakerViewProps = ReturnType<typeof useTieBreaker>;
