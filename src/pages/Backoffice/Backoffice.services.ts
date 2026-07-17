import { useContext, useEffect, useState } from "react";
import {
  getAdminOverview,
  getAdminGameStats,
  getAdminCaseStats,
  getAdminUserStats,
  AdminOverview,
  AdminGameStats,
  AdminCaseRow,
  AdminUsersPage,
} from "../../services/admin/AdminServices";
import UserContext from "../../UserContext";

export type Window = 7 | 30 | null;

export const useBackofficeServices = () => {
  const { userData } = useContext(UserContext);
  const [days, setDays] = useState<Window>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [games, setGames] = useState<AdminGameStats | null>(null);
  const [cases, setCases] = useState<AdminCaseRow[] | null>(null);
  const [usersPage, setUsersPage] = useState<AdminUsersPage | null>(null);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const isAdmin = !!userData?.isAdmin;

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([getAdminOverview(days), getAdminGameStats(days), getAdminCaseStats(days)])
      .then(([o, g, c]) => {
        if (!active) return;
        setOverview(o);
        setGames(g);
        setCases(c);
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, days]);

  // the user table follows its own paging and search, debounced against typing
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const t = setTimeout(() => {
      getAdminUserStats(days, page, search)
        .then((res) => {
          if (active) setUsersPage(res);
        })
        .catch(() => {
          if (active) setUsersPage(null);
        });
    }, search ? 300 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [isAdmin, days, page, search]);

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return {
    userData,
    isAdmin,
    days,
    setDays,
    overview,
    games,
    cases,
    usersPage,
    page,
    setPage,
    search,
    changeSearch,
    loading,
    error,
  };
};
