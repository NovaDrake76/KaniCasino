import type { PickGame } from "../../services/daisu/DaisuService";
import type { useDaisu } from "./Daisu.services";

export type Face = "idle" | "happy" | "surprised" | "sad";

export interface Line {
  key: string;
  vars?: Record<string, string | number>;
}

export interface Burst {
  id: number;
  amount: number;
  credit: number;
  game: string;
}

export interface CreditView {
  game: PickGame;
  amount: number;
  path: string;
  name: string;
}

export type DaisuViewProps = ReturnType<typeof useDaisu>;
