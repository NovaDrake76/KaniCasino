import { useTodayStrip } from "./TodayStrip.services";

// placeholders until the first answer; a dash and no clock when the answer failed or there is nothing on
export type CardData =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; amount: number; endsAt: number; skew: number };

// the player's place: with the word from md up, the place alone on a phone
export interface YouChip {
  full: string;
  short: string;
}

export interface TodayCard {
  name: string;
  data: CardData;
}

export type TodayStripViewProps = ReturnType<typeof useTodayStrip>;
