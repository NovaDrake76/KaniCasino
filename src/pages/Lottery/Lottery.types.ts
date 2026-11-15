import { useLotteryServices } from "./Lottery.services";
import type { DrumSpeed } from "./Drum/Drum.types";

export type BallTone = "plain" | "drawn" | "hit" | "miss" | "pending";

export interface BallView {
  n: number | null;
  tone: BallTone;
}

export interface GridCell {
  n: number;
  picked: boolean;
  // three are picked and this is not one of them, so a tap does nothing
  muted: boolean;
}

export interface MainAction {
  label: string;
  onClick: () => void;
  disabled: boolean;
}

export interface QuickMany {
  n: number;
  label: string;
  disabled: boolean;
}

export interface SlipRow {
  key: string;
  numbers: number[];
  remove: () => void;
}

export interface PrizeRow {
  label: string;
  value: string;
  top: boolean;
}

export interface StageView {
  ready: boolean;
  jackpot: string;
  rolling: string | null;
  clockLabel: string;
  countdown: string | null;
  status: string;
  won: boolean;
  speed: DrumSpeed;
  // the numbers still in the drum
  drum: number[];
  drumLabel: string;
  // three slots, a pending ball for one still empty
  tray: BallView[];
  trayLabel: string;
  drop: boolean;
  pick: BallView[];
  prizes: PrizeRow[];
}

export interface TierView {
  label: string;
  value: string;
}

export interface MyTicketRow {
  key: string;
  balls: BallView[];
  prize: string;
  won: boolean;
}

export interface LastDrawView {
  title: string;
  date: string;
  // set while a first replay of this draw is still drawing, in place of everything that would give it away
  watching: string | null;
  watch: MainAction;
  balls: BallView[];
  jackpotLine: string;
  tiers: TierView[];
  mine: MyTicketRow[];
  total: string | null;
}

export interface CheckView {
  running: boolean;
  text: string | null;
  ok: boolean | null;
  run: () => void;
}

export interface DrawDetails {
  seedHash: string;
  serverSeed: string;
  check: CheckView;
  mine: MyTicketRow[];
}

export interface HistoryRow {
  number: number;
  label: string;
  date: string;
  balls: BallView[];
  jackpot: string;
  outcome: string;
  won: boolean;
  open: boolean;
  toggle: () => void;
  details: DrawDetails | null;
}

export interface Pager {
  label: string;
  newer: (() => void) | null;
  older: (() => void) | null;
}

export type LotteryViewProps = ReturnType<typeof useLotteryServices>;
