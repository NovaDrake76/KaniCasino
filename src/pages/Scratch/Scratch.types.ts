import { useScratchServices } from "./Scratch.services";
import type { TicketId } from "./scratchTickets";
import type { TicketLook } from "./ticketLook";

export interface PocketResult {
  symbol: string | null;
  multiplier: number;
  payout: number;
  cells: string[];
  line: number[] | null;
  winningCells: number[];
  rollId: string | null;
}

export interface NineSpot {
  symbol: string;
  prize: number;
}

export interface NineResult {
  lucky: string[];
  multiplier: number;
  payout: number;
  spots: NineSpot[];
  winningSpots: number[];
  rollId: string | null;
}

export type StackTicket = PocketResult | NineResult;

export interface StackPurchase {
  ticket: TicketId;
  price: number;
  quantity: number;
  tickets: StackTicket[];
  totalPayout: number;
  balanceAfterCharge: number;
  balance: number;
}

// a borrowed treasure ticket as the server shows it: an active one carries only the spots already picked
export interface TreasureView {
  id: string;
  ticket: TicketId;
  price: number;
  status: "active" | "settled";
  picks: { cell: number; find: number }[];
  left: number;
  board: number[] | null;
  payout: number;
  rollId: string | null;
}

export interface TreasurePurchase {
  ticket: TicketId;
  price: number;
  quantity: number;
  game: TreasureView;
  balanceAfterCharge: number;
  balance: number;
}

export interface PickAnswer extends TreasureView {
  cell: number;
  find: number;
  balance?: number | null;
}

// how the coating leaves: scratched away and faded, or wiped off by reveal all
export type CoatingState = "covered" | "wiping" | "wiped" | "faded";

export interface MainAction {
  label: string;
  onClick: () => void;
  disabled: boolean;
}

// found: something came back, but less than the ticket cost, so it reads as neither a win nor a loss
export type ResultLine = { kind: "won" | "found" | "lost"; text: string };

export interface StackSummary {
  count: string;
  won: string;
  best: string;
}

export interface CatalogueCard {
  id: TicketId;
  look: TicketLook;
  name: string;
  series: string;
  price: string;
  rule: string;
  topLabel: string;
  top: string;
  selected: boolean;
}

export interface KeyRow {
  symbol: string;
  times: string | null;
  prize: string;
}

// the full prize key the panel lists: symbol rows for pocket and treasure, the printable prizes and multipliers for nine
export type PanelKey =
  | { kind: "rows"; rows: KeyRow[] }
  | { kind: "chips"; groups: { label: string; values: string[] }[] };

export interface TicketDetails {
  id: TicketId;
  label: string;
  name: string;
  price: string;
  rules: string[];
  key: PanelKey;
}

// one per ticket of a stack, or per pick of a treasure ticket; current is the one being scratched
export interface Pip {
  mark: "unscratched" | "lost" | "found" | "won";
  current: boolean;
}

// the panel once a ticket is in play or finished: how far the stack or the picks have got, not the prize key again
export interface TicketProgress {
  label: string;
  name: string;
  price: string;
  pips: { label: string; items: Pip[] } | null;
  lines: { label: string; value: string }[];
  // empty line rows kept in place while a stack plays, so the summary it ends on does not grow the panel
  heldLines: number;
}

// reserve: the other tickets' details, laid invisibly under the selected one so the panel keeps the tallest one's height
export type PanelView =
  | { kind: "details"; details: TicketDetails; reserve: TicketDetails[] }
  | { kind: "progress"; progress: TicketProgress };

export interface ZoneCoating {
  key: string;
  label: string;
  active: boolean;
  state: CoatingState;
  onRub: () => void;
  onComplete: () => void;
}

export type CellMark = "plain" | "win" | "dim";

export interface PocketBoard {
  kind: "pocket";
  cells: { symbol: string; mark: CellMark }[];
  coating: ZoneCoating;
}

export interface NineBoard {
  kind: "nine";
  luckyLabel: string;
  multiplierLabel: string;
  lucky: string[];
  multiplier: string;
  spots: { symbol: string; prize: string; mark: CellMark }[];
  coating: ZoneCoating;
}

export interface TreasureSpot {
  cell: number;
  find: { symbol: string | null; amount: string } | null;
  // covered: foil on; open: scratched, and kept once the ticket is done; missed: one left, shown once it is done
  mark: "covered" | "open" | "kept" | "missed";
  coating: {
    key: string;
    active: boolean;
    state: CoatingState;
    onStart: () => boolean;
    onRub: () => void;
    onComplete: () => void;
  };
}

export interface TreasureBoard {
  kind: "treasure";
  emptyLabel: string;
  spots: TreasureSpot[];
}

export type Board = PocketBoard | NineBoard | TreasureBoard;

export interface TicketFace {
  look: TicketLook;
  brand: string;
  series: string;
  name: string;
  price: string;
  rules: string[];
  key: KeyRow[] | null;
  serial: string;
  code: string;
  verify: (() => void) | null;
  board: Board;
}

// laid out, unseen, from the moment a ticket is on the stage, so showing them when it is done moves nothing
export interface FinishedActions {
  shown: boolean;
  buyAgain: MainAction;
  back: MainAction;
}

export type Stage =
  | { kind: "catalogue"; brand: string; selectedLabel: string; cards: CatalogueCard[]; select: (id: TicketId) => void }
  | {
      kind: "ticket";
      counter: string | null;
      runningTotal: string | null;
      summary: StackSummary | null;
      ticket: TicketFace;
      result: ResultLine | null;
      finished: FinishedActions;
    };

export type ScratchViewProps = ReturnType<typeof useScratchServices>;
