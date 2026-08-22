import api from "../api";

// prices come back as integer basis points, the way the server holds them. the ui turns
// them into a percentage or a KP amount at the edge and never does arithmetic on floats.
export const ONE = 10000;

// the server puts the reason in the body; anything else that reached the catch is a
// network failure and has nothing worth showing
export const messageOf = (error: unknown, fallback: string): string => {
  const body = (error as { response?: { data?: { message?: string } } })?.response?.data;
  return (body && body.message) || fallback;
};

export const toPercent = (bps: number) => Math.round(bps / 100);
export const toKp = (bps: number) => bps / ONE;

export interface Outcome {
  key: string;
  label: string;
  image?: string;
  priceBps: number;
  volume: number;
  shares: number;
  avgPriceBps: number;
  spent: number;
}

export interface Market {
  _id: string;
  slug: string;
  title: string;
  description: string;
  image?: string;
  category: string;
  status: "open" | "closed" | "resolved" | "void";
  endsAt?: string;
  volume: number;
  traders: number;
  vigBps: number;
  resolvedOutcome?: string;
  resolutionNote?: string;
  resolvedAt?: string;
  outcomes: Outcome[];
}

export interface MarketPage {
  predictions: Market[];
  totalPages: number;
  currentPage: number;
  categories: string[];
}

export interface Quote {
  shares: number;
  amount: number;
  avgPriceBps: number;
  startBps: number;
  endBps: number;
  prices: number[];
  held: number;
}

export interface TradeResult {
  prediction: Market;
  walletBalance?: number;
  spent?: number;
  received?: number;
}

export interface MarketTrade {
  _id: string;
  user: { _id: string; username: string; profilePicture: string; level: number };
  action: "buy" | "sell";
  shares: number;
  amount: number;
  avgPriceBps: number;
  outcomeKey: string;
  outcomeLabel: string;
  createdAt: string;
}

export interface PriceSeries {
  key: string;
  label: string;
  points: { at: string; priceBps: number }[];
}

export interface HeldPosition {
  _id: string;
  shares: number;
  spent: number;
  avgPriceBps: number;
  settled: boolean;
  payout: number;
  outcomeKey: string;
  outcomeLabel: string;
  priceBps: number;
  value: number;
  market: {
    slug: string;
    title: string;
    image?: string;
    status: Market["status"];
    endsAt?: string;
    resolvedOutcome?: string;
  };
}

interface ListParams {
  page?: number;
  status?: string;
  category?: string;
  q?: string;
}

export const listMarkets = async (params: ListParams = {}): Promise<MarketPage> => {
  const { data } = await api.get("/predictions", { params });
  return data;
};

export const getMarket = async (slug: string): Promise<Market> => {
  const { data } = await api.get(`/predictions/${slug}`);
  return data;
};

export const getMarketHistory = async (slug: string): Promise<PriceSeries[]> => {
  const { data } = await api.get(`/predictions/${slug}/history`);
  return data.series;
};

export const getMarketTrades = async (slug: string): Promise<MarketTrade[]> => {
  const { data } = await api.get(`/predictions/${slug}/trades`);
  return data.trades;
};

// the quote and the fill are the same call on the server, so what this returns is what
// the next one charges unless somebody else trades in between
export const quoteTrade = async (
  slug: string,
  outcome: string,
  action: "buy" | "sell",
  shares: number
): Promise<Quote> => {
  const { data } = await api.post(`/predictions/${slug}/quote`, { outcome, action, shares });
  return data;
};

export const placeTrade = async (
  slug: string,
  outcome: string,
  action: "buy" | "sell",
  shares: number
): Promise<TradeResult> => {
  const { data } = await api.post(`/predictions/${slug}/trade`, { outcome, action, shares });
  return data;
};

export const getMyPositions = async (): Promise<HeldPosition[]> => {
  const { data } = await api.get("/predictions/me/positions");
  return data.positions;
};
