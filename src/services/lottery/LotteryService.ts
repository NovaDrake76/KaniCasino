import api from "../api";

export interface LotteryRules {
  pool: number;
  pick: number;
  price: number;
  cap: number;
  drawHourUtc: number;
  salesCloseMs: number;
  prizes: Record<string, number>;
  jackpotBase: number;
  jackpotShare: number;
  combinations: number;
}

export interface OpenDraw {
  number: number;
  status: "open" | "drawing";
  drawAt: string;
  salesCloseAt: string;
  jackpot: number;
  tickets: number;
  carried: number;
  seedHash: string;
}

export interface JackpotWinner {
  userId: string;
  username: string;
  tickets: number;
}

export interface WinnerCounts {
  m1: number;
  m2: number;
  m3: number;
}

export interface SettledDraw {
  number: number;
  drawAt: string;
  settledAt: string;
  numbers: number[];
  jackpot: number;
  jackpotEach: number;
  tickets: number;
  carried: number;
  winners: WinnerCounts;
  jackpotWinners: JackpotWinner[];
  seedHash: string;
  serverSeed: string;
}

export interface LotteryTicket {
  numbers: number[];
  matches?: number | null;
  prize?: number;
}

export interface LotteryMe {
  tickets: LotteryTicket[];
  count: number;
  left: number;
  last: { number: number; tickets: LotteryTicket[]; won: number } | null;
}

export interface LotteryState {
  serverTime: string;
  rules: LotteryRules;
  draw: OpenDraw | null;
  last: SettledDraw | null;
  me: LotteryMe | null;
}

export interface LotteryPurchase {
  tickets: LotteryTicket[];
  balance: number;
  draw: { number: number; jackpot: number; tickets: number };
  me: { count: number; left: number };
}

export interface DrawPage {
  page: number;
  pages: number;
  draws: SettledDraw[];
}

export interface DrawTickets {
  number: number;
  status: string;
  numbers: number[] | null;
  tickets: LotteryTicket[];
  won: number;
}

// what the socket says when anybody buys, and when a draw is settled
export interface PotUpdate {
  draw: number;
  jackpot: number;
  tickets: number;
}

export interface DrawnEvent {
  number: number;
  numbers: number[];
  jackpot: number;
  jackpotEach: number;
  winners: WinnerCounts;
  jackpotWinners: JackpotWinner[];
  next: OpenDraw | null;
}

export const getLottery = () => api.get<LotteryState>("/lottery").then((r) => r.data);

export const buyLotteryTickets = (picks: number[][]) => api.post<LotteryPurchase>("/lottery/tickets", { picks }).then((r) => r.data);

export const getLotteryDraws = (page: number) => api.get<DrawPage>("/lottery/draws", { params: { page } }).then((r) => r.data);

export const getDrawTickets = (number: number) => api.get<DrawTickets>(`/lottery/draws/${number}/tickets`).then((r) => r.data);
