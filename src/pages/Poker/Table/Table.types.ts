import { CashOutOptions, PokerTable, PooledItem, StakeableItem } from "../../../services/poker/PokerService";

export interface LegalAction {
  type: "fold" | "check" | "call" | "bet" | "raise";
  amount?: number;
  min?: number;
  max?: number;
  allInOnly?: boolean;
}

export interface ViewTable extends PokerTable {
  yourSeat: number | null;
  legal: LegalAction[];
}

export interface ActionFeedEntry {
  id: number;
  seat: number;
  username: string;
  action: string;
  to: number | null;
  auto: boolean;
}

export interface ShowdownSummary {
  handNumber: number;
  board: number[];
  rake: number;
  winners: { seat: number; amount: number; username: string; hand: string | null }[];
  atRisk: { name: string; rarity: string; value: number; seat: number }[];
}

export interface TableServices {
  table: ViewTable | null;
  loading: boolean;
  error: string | null;
  isLogged: boolean;
  signIn: () => void;
  // seats rendered from the hero's point of view, so you are always at the bottom
  order: number[];
  heroSeat: number | null;
  secondsLeft: number | null;
  feed: ActionFeedEntry[];
  showdown: ShowdownSummary | null;
  atRiskIds: Set<string>;

  buyInSeat: number | null;
  openBuyIn: (seat: number) => void;
  closeBuyIn: () => void;
  buyInItems: StakeableItem[];
  buyInLoading: boolean;
  submitBuyIn: (kp: number, uniqueIds: string[]) => Promise<void>;

  cashOutOpen: boolean;
  cashOut: CashOutOptions | null;
  openCashOut: () => void;
  closeCashOut: () => void;
  submitCashOut: (picks: string[]) => Promise<void>;

  sittingOut: boolean;
  sitBackIn: () => void;
  act: (type: LegalAction["type"], to?: number) => void;
  acting: boolean;
  pool: PooledItem[];
}
