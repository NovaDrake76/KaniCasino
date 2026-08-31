import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getAdminOverview,
  getAdminGameStats,
  getAdminCaseStats,
  getAdminUserStats,
  getAdminTimeseries,
  getAdminBigWins,
  getAdminPlayerDetail,
  AdminOverview,
  AdminGameStats,
  AdminCaseRow,
  AdminUsersPage,
  AdminBigWin,
  AdminPlayerDetail,
  TimeseriesPoint,
} from "../../services/admin/AdminServices";
import UserContext from "../../UserContext";
import { AdminUrlState, Tab, parseAdminUrl, writeAdminUrl } from "./Backoffice.tabs";

export type Window = 7 | 30 | null;

export const useBackofficeServices = () => {
  const { userData } = useContext(UserContext);
  const [params, setParams] = useSearchParams();

  // the url is the state. nothing is mirrored into react state, so there is one place a
  // value can come from and the back button cannot disagree with what is rendered.
  const url = useMemo(() => parseAdminUrl(params), [params]);
  const { tab, days, page, search, playerId } = url;

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [games, setGames] = useState<AdminGameStats | null>(null);
  const [cases, setCases] = useState<AdminCaseRow[] | null>(null);
  const [series, setSeries] = useState<TimeseriesPoint[] | null>(null);
  const [wins, setWins] = useState<AdminBigWin[] | null>(null);
  const [usersPage, setUsersPage] = useState<AdminUsersPage | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [player, setPlayer] = useState<AdminPlayerDetail | null>(null);
  const [playerLoading, setPlayerLoading] = useState<boolean>(false);

  const isAdmin = !!userData?.isAdmin;

  const go = useCallback(
    (next: Partial<AdminUrlState>) => setParams(writeAdminUrl({ ...url, ...next })),
    [setParams, url]
  );

  // the headline numbers and the charts. every tab shows the window toggle, so this is the
  // one fetch that is not deferred.
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([getAdminOverview(days), getAdminTimeseries(days)])
      .then(([o, s]) => {
        if (!active) return;
        setOverview(o);
        setSeries(s);
        setError(false);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [isAdmin, days]);

  // the rest is fetched when its tab is opened, rather than five requests on every load
  // for four sections nobody is looking at
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    if (tab === "games" || tab === "overview") {
      getAdminGameStats(days).then((g) => active && setGames(g)).catch(() => undefined);
    }
    if (tab === "games") {
      getAdminBigWins(days).then((w) => active && setWins(w)).catch(() => undefined);
    }
    if (tab === "cases") {
      getAdminCaseStats(days).then((c) => active && setCases(c)).catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [isAdmin, tab, days]);

  // the user table follows its own paging and search, debounced against typing
  useEffect(() => {
    if (!isAdmin || tab !== "players" || playerId) return;
    let active = true;
    setUsersLoading(true);
    const t = setTimeout(() => {
      getAdminUserStats(days, page, search)
        .then((res) => active && setUsersPage(res))
        .catch(() => active && setUsersPage(null))
        .finally(() => active && setUsersLoading(false));
    }, search ? 300 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [isAdmin, tab, days, page, search, playerId]);

  // the drill-down loads on open and follows the window toggle while open
  useEffect(() => {
    if (!isAdmin || !playerId) return;
    let active = true;
    setPlayerLoading(true);
    getAdminPlayerDetail(playerId, days)
      .then((d) => active && setPlayer(d))
      .catch(() => active && setPlayer(null))
      .finally(() => active && setPlayerLoading(false));
    return () => {
      active = false;
    };
  }, [isAdmin, playerId, days]);

  return {
    userData,
    isAdmin,
    tab,
    setTab: (next: Tab) => go({ tab: next, playerId: null, page: 1 }),
    days,
    setDays: (next: Window) => go({ days: next }),
    overview,
    games,
    cases,
    series,
    wins,
    usersPage,
    page,
    setPage: (next: number) => go({ page: next }),
    search,
    // a new search starts at the first page, or page 4 of the old results is asked for
    changeSearch: (value: string) => go({ search: value, page: 1 }),
    loading,
    usersLoading,
    error,
    playerId,
    player,
    playerLoading,
    openPlayer: (id: string) => go({ playerId: id, tab: "players" }),
    closePlayer: () => {
      setPlayer(null);
      go({ playerId: null });
    },
  };
};
