import { Market, MarketTrade, PriceSeries, Quote } from "../../../services/predictions/PredictionService";
import { Range } from "../../../components/timeRange";

export type TradeAction = "buy" | "sell";

export interface MarketViewProps {
  market: Market | null;
  loading: boolean;
  notFound: boolean;
  series: PriceSeries[];
  loadingSeries: boolean;
  range: Range;
  setRange: (range: Range) => void;
  // a yes-or-no market has one number worth showing, and it goes next to the title
  binary: boolean;
  chancePct: number | null;
  trades: MarketTrade[];
  isLogged: boolean;
  walletBalance: number;
  selected: string | null;
  select: (key: string) => void;
  action: TradeAction;
  setAction: (action: TradeAction) => void;
  sharesInput: string;
  setSharesInput: (value: string) => void;
  shares: number;
  // the ceiling the field will accept: what is held when selling, unbounded when buying
  maxShares: number | null;
  quote: Quote | null;
  quoting: boolean;
  quoteError: string | null;
  submitting: boolean;
  submit: () => void;
  setSharesTo: (count: number) => void;
  bumpShares: (by: number) => void;
  heldOf: (key: string) => number;
  avgOf: (key: string) => number;
  colorOf: (key: string) => string;
  movedOf: (key: string) => "up" | "down" | null;
}
