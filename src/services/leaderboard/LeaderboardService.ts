import api from "../api";

export interface BoardBadge {
  key: string;
  label?: string | null;
  note?: string | null;
}

export interface BoardStanding {
  _id: string;
  rank: number;
  points: number;
  bets: number;
  prize: number;
  // a seat nobody has taken yet: on the board, on nought, winning nothing
  placeholder?: boolean;
  username: string;
  slug?: string;
  profilePicture: string;
  level: number;
  fixedItem?: unknown;
  badge: BoardBadge | null;
}

export interface BoardMe {
  _id: string;
  points: number;
  bets: number;
  rank: number | null;
  // what it would take to reach the last paid place; 0 once they are in it
  toPaidPlace: number;
  prize: number;
}

export interface Board {
  boardId: string;
  startsAt: string;
  endsAt: string;
  // the clock the countdown trusts, so a wrong device time cannot skew it
  serverTime: string;
  paidPlaces: number;
  pool: number;
  prizes: number[];
  standings: BoardStanding[];
  me: BoardMe | null;
}

export interface PointsGame {
  key: string;
  type: string;
  edge: number | null;
  multiplier: number;
}

export const getBoard = async (): Promise<Board> => {
  const { data } = await api.get("/leaderboard");
  return data;
};

export const getPoints = async (): Promise<{ games: PointsGame[] }> => {
  const { data } = await api.get("/leaderboard/points");
  return data;
};
