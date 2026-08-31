import { Window } from "./Backoffice.services";

// the page used to hold every section at once, so reaching the player table meant scrolling
// past the charts, the games, the wins and every case. one section at a time instead.
export const TABS = ["overview", "games", "cases", "players", "predictions"] as const;
export type Tab = (typeof TABS)[number];

export const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  games: "Games",
  cases: "Cases",
  players: "Players",
  predictions: "Predictions",
};

export const WINDOWS: { value: Window; text: string }[] = [
  { value: 7, text: "7d" },
  { value: 30, text: "30d" },
  { value: null, text: "All" },
];

// every bit of state the page has lives in the query string, so the back button, a reload
// and a pasted link all land where they were. it used to be react state only: opening a
// player and coming back dropped you at the default view with the search box empty.
export interface AdminUrlState {
  tab: Tab;
  days: Window;
  page: number;
  search: string;
  playerId: string | null;
}

const isTab = (v: string | null): v is Tab => !!v && (TABS as readonly string[]).includes(v);

export function parseAdminUrl(params: URLSearchParams): AdminUrlState {
  const raw = params.get("days");
  const days: Window = raw === "7" ? 7 : raw === "30" ? 30 : null;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const playerId = params.get("player");
  const tabParam = params.get("tab");

  return {
    // a link to a player is a link to the players tab whatever the tab says, or the row
    // that opened it would be behind a tab you are not looking at
    tab: playerId ? "players" : isTab(tabParam) ? tabParam : "overview",
    days,
    page,
    search: params.get("q") || "",
    playerId,
  };
}

// only what differs from the default is written, so the common url stays short and a
// shared link carries no noise
export function writeAdminUrl(state: AdminUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.tab !== "overview") params.set("tab", state.tab);
  if (state.days !== null) params.set("days", String(state.days));
  if (state.search) params.set("q", state.search);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.playerId) params.set("player", state.playerId);
  return params;
}
