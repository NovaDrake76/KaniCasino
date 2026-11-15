import { useScratchCoating } from "./ScratchCoating.services";
import type { CoatingState } from "../Scratch.types";

export interface ScratchCoatingProps {
  // painted into the foil; a small treasure spot paints none
  label: string;
  active: boolean;
  state: CoatingState;
  // the brush radius as a fraction of the coating's width, and the share that has to be cleared
  brush: number;
  threshold: number;
  // asked once, when a single press has rubbed the coating to its commit point; a lift before that, or a false, puts the
  // foil back whole. a coating without it is spent from its first stroke
  onStart?: () => boolean;
  onRub: () => void;
  onComplete: () => void;
  testId?: string;
}

export interface Fleck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

export type ScratchCoatingViewProps = ReturnType<typeof useScratchCoating>;
