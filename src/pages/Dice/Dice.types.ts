import { useDiceServices } from "./Dice.services";
import { Direction } from "./diceControls";

export interface DiceRollResult {
  betAmount: number;
  target: number;
  direction: Direction;
  result: number; // 0..9999
  resultValue: number; // 0.00..99.99
  multiplier: number;
  winChance: number;
  won: boolean;
  payout: number;
  balance: number;
  rollId: string | null;
}

export interface DiceHistoryEntry {
  key: string;
  resultValue: number;
  won: boolean;
  multiplier: number;
  rollId: string | null;
}

export type DiceViewProps = ReturnType<typeof useDiceServices>;
