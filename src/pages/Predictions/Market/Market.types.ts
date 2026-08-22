import { Market, MarketTrade, PriceSeries, Quote } from "../../../services/predictions/PredictionService";

export type TradeAction = "buy" | "sell";

export interface MarketViewProps {
  market: Market | null;
  loading: boolean;
  notFound: boolean;
  series: PriceSeries[];
  loadingSeries: boolean;
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
  quote: Quote | null;
  quoting: boolean;
  quoteError: string | null;
  submitting: boolean;
  submit: () => void;
  setMaxShares: () => void;
  bumpShares: (by: number) => void;
  heldOf: (key: string) => number;
  avgOf: (key: string) => number;
  colorOf: (key: string) => string;
  movedOf: (key: string) => "up" | "down" | null;
}
