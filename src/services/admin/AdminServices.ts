import api from "../api";

export interface AdminOverview {
  users: { total: number; new: number; active: number };
  economy: { supply: number; houseBalance: number; escrow: number };
}

export interface GameLine {
  game: string;
  plays: number;
  wagered: number;
  paidOut: number;
  net: number;
  uniquePlayers: number;
  biggestWin: number;
  theoRtp: number | null;
}

export interface TimeseriesPoint {
  day: string;
  wagered: number;
  paidOut: number;
  ggr: number;
  faucet: number;
  players: number;
}

export interface AdminBigWin {
  userId: string;
  username: string;
  profilePicture: string;
  type: string;
  amount: number;
  bet: number | null;
  multiple: number | null;
  at: string;
}

export interface AdminPlayerDetail {
  user: {
    id: string;
    username: string;
    profilePicture: string;
    level: number;
    xp: number;
    walletBalance: number;
    isAdmin: boolean;
    weeklyWinnings: number;
    joined: string;
    inventoryCount: number;
    referredBy: string | null;
    referrals: number;
  };
  totals: {
    wagered: number;
    won: number;
    net: number;
    faucet: number;
    marketSpent: number;
    marketEarned: number;
    itemsSold: number;
    biggestWin: { type: string | null; amount: number };
    lastActive: string | null;
  };
  games: { game: string; plays: number; wagered: number; won: number; net: number }[];
  recent: { type: string; direction: "credit" | "debit"; amount: number; balanceAfter: number; createdAt: string }[];
}

export interface AdminGameStats {
  games: GameLine[];
  houseLines: { type: string; net: number; count: number }[];
  issuance: { type: string; issued: number; count: number }[];
}

export interface AdminCaseRow {
  caseId: string;
  title: string;
  image: string | null;
  price: number | null;
  opens: number;
  spent: number;
  lastOpened: string;
}

export interface AdminUserRow {
  id: string;
  username: string;
  profilePicture: string;
  level: number;
  walletBalance: number;
  isAdmin: boolean;
  joined: string;
  wagered: number;
  lastActive: string | null;
  referredBy: string | null;
}

export interface AdminUsersPage {
  total: number;
  page: number;
  pages: number;
  users: AdminUserRow[];
}

const withDays = (days: number | null) => (days ? { days } : {});

export const getAdminOverview = async (days: number | null): Promise<AdminOverview> =>
  (await api.get("/admin/stats/overview", { params: withDays(days) })).data;

export const getAdminGameStats = async (days: number | null): Promise<AdminGameStats> =>
  (await api.get("/admin/stats/games", { params: withDays(days) })).data;

export const getAdminCaseStats = async (days: number | null): Promise<AdminCaseRow[]> =>
  (await api.get("/admin/stats/cases", { params: withDays(days) })).data;

export const getAdminUserStats = async (
  days: number | null,
  page: number,
  search: string
): Promise<AdminUsersPage> =>
  (await api.get("/admin/stats/users", { params: { ...withDays(days), page, search } })).data;

export const getAdminTimeseries = async (days: number | null): Promise<TimeseriesPoint[]> =>
  (await api.get("/admin/stats/timeseries", { params: withDays(days) })).data;

export const getAdminBigWins = async (days: number | null): Promise<AdminBigWin[]> =>
  (await api.get("/admin/stats/wins", { params: withDays(days) })).data;

export const getAdminPlayerDetail = async (id: string, days: number | null): Promise<AdminPlayerDetail> =>
  (await api.get(`/admin/stats/users/${id}`, { params: withDays(days) })).data;
