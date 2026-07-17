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
