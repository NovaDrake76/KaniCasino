import type { useBlackjackServices } from "./Blackjack.services";

export interface BlackjackHandSide {
  cards: number[];
  bet: number;
  doubled: boolean;
  total: number;
  soft: boolean;
  outcome: "blackjack" | "win" | "push" | "lose" | null;
  payout: number;
}

export interface BlackjackHandState {
  handId: string;
  status: "active" | "settled";
  actionSeq: number;
  betAmount: number;
  hands: BlackjackHandSide[];
  activeHandIndex: number;
  dealer: { cards: number[]; total: number; hidden: boolean };
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  totalPayout: number;
  fair: { clientSeed: string; serverSeedHash: string; nonce: number };
  rollId: string | null;
}

export interface BlackjackHistoryEntry {
  handId: string;
  rollId: string | null;
  outcome: string | null;
  payout: number;
  betAmount: number;
}

export type BlackjackPhase = "idle" | "player" | "revealing" | "settled";

export type BlackjackViewProps = ReturnType<typeof useBlackjackServices>;
