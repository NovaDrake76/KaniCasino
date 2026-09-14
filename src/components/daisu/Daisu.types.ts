import type { PickGame } from "../../services/daisu/DaisuService";
import type { Mission } from "../../services/missions/MissionService";
import type { useDaisu } from "./Daisu.services";

export type Face = "idle" | "happy" | "surprised" | "sad";

// the bubble in the corner, the card she talks from, and her room with everything in it
export type Stage = "bubble" | "popup" | "room";

export type RoomTab = "missions" | "boosts";

export interface Line {
  key: string;
  vars?: Record<string, string | number>;
}

// one click on the jar, floating up as a number, a little off center so a fast run fans out
export interface Pop {
  id: number;
  amount: number;
  x: number;
}

// the clicks since the last send, counted up under the jar until the server answers for them
export interface Run {
  id: number;
  amount: number;
  state: "open" | "sending" | "sent" | "failed";
  // restarts the countdown bar on every click
  lastClickAt: number;
}

export interface CreditView {
  game: PickGame;
  amount: number;
  path: string;
  name: string;
}

export interface MissionGroup {
  key: string;
  label: string;
  missions: Mission[];
}

export type DaisuViewProps = ReturnType<typeof useDaisu>;
