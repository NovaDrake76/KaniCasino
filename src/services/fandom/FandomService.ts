import api from "../api";

export interface FanRank {
  name: string;
  image: string;
  rarity: string;
  count: number;
  rank: number;
  fans: number;
  // the runner-up's count and when this player pinned, both filled by the sweep
  second?: number;
  since?: string;
}

export interface Fan {
  userId: string;
  username: string;
  profilePicture: string;
  level: number;
  count: number;
  since: string;
}

export interface FanBoardSummary {
  name: string;
  image: string;
  rarity: string;
  caseId: string | null;
  fanCount: number;
  topCount: number;
  secondCount: number;
  // how far clear the leader is; a board with nobody chasing carries a large sentinel
  gap: number;
  top: Fan | null;
}

export interface FanBoard extends FanBoardSummary {
  ranks: Fan[];
  updatedAt: string;
}

export interface BoardsPage {
  boards: FanBoardSummary[];
  page: number;
  totalPages: number;
  total: number;
}

export interface ReachRow {
  name: string;
  image: string;
  rarity: string;
  caseId: string | null;
  mine: number;
  leader: number;
  leaderName: string | null;
  behind: number;
  fanCount: number;
  pinned: boolean;
  holding: boolean;
}

export interface Collector {
  userId: string;
  username: string;
  profilePicture: string;
  level: number;
  distinct: number;
  total: number;
}

export interface CollectionBoard {
  characterCount: number;
  updatedAt: string | null;
  ranks: Collector[];
}

export type BoardSort = "contested" | "biggest" | "open";

export async function getBoards(sort: BoardSort, page: number, q: string): Promise<BoardsPage> {
  const res = await api.get("/fandom", { params: { sort, page, q: q || undefined } });
  return res.data;
}

export async function getBoard(name: string): Promise<FanBoard> {
  const res = await api.get(`/fandom/${encodeURIComponent(name)}`);
  return res.data;
}

export interface MyStanding {
  mine: number;
  itemId: string | null;
  holding: boolean;
  pinned: boolean;
  pinnedName: string | null;
  behind: number;
}

export async function getMyStanding(name: string): Promise<MyStanding> {
  const res = await api.get(`/fandom/${encodeURIComponent(name)}/me`);
  return res.data;
}

export async function getReach(): Promise<ReachRow[]> {
  const res = await api.get("/fandom/reach");
  return res.data.reach || [];
}

export async function getCollectors(): Promise<CollectionBoard> {
  const res = await api.get("/fandom/collectors");
  return res.data;
}
