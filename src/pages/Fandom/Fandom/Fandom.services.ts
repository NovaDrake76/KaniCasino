import { useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import UserContext from "../../../UserContext";
import {
  getBoards,
  getCollectors,
  getReach,
  BoardSort,
  Collector,
  FanBoardSummary,
  ReachRow,
} from "../../../services/fandom/FandomService";
import { rarityColor } from "../../../utils/rarity";
import { BoardCard, FandomTab, ReachCard } from "./Fandom.types";
import i18n from "../../../i18n";

const SEARCH_DEBOUNCE_MS = 350;
const TABS: FandomTab[] = ["contested", "biggest", "open", "reach", "collectors"];

const isSort = (tab: FandomTab): tab is BoardSort =>
  tab === "contested" || tab === "biggest" || tab === "open";

export const useFandomServices = () => {
  const { isLogged, toogleUserFlow } = useContext(UserContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab") as FandomTab | null;
  const tab: FandomTab = tabParam && TABS.includes(tabParam) ? tabParam : "contested";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [boards, setBoards] = useState<FanBoardSummary[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [reach, setReach] = useState<ReachRow[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [characterCount, setCharacterCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // the debounced term owns both the query and the url, in one place, so neither can
  // write back the value the other just wrote
  useEffect(() => {
    const id = setTimeout(() => {
      const trimmed = search.trim();
      setQuery(trimmed);
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if ((params.get("q") || "") === trimmed) return params;
        if (trimmed) params.set("q", trimmed);
        else params.delete("q");
        params.delete("page");
        return params;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search, setSearchParams]);

  const move = (next: Record<string, string>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    setSearchParams(params);
  };

  const selectTab = (next: FandomTab) => move({ tab: next === "contested" ? "" : next, page: "" });
  const goToPage = (next: number) => move({ page: next > 1 ? String(next) : "" });

  useEffect(() => {
    let live = true;
    setLoading(true);

    const load = async () => {
      if (isSort(tab)) {
        const data = await getBoards(tab, page, query);
        if (!live) return;
        setBoards(data.boards);
        setTotalPages(data.totalPages);
        return;
      }
      if (tab === "collectors") {
        const data = await getCollectors();
        if (!live) return;
        setCollectors(data.ranks);
        setCharacterCount(data.characterCount);
        return;
      }
      if (!isLogged) {
        setReach([]);
        return;
      }
      const rows = await getReach();
      if (live) setReach(rows);
    };

    load()
      .catch((err) => console.error(err))
      .finally(() => live && setLoading(false));

    return () => {
      live = false;
    };
  }, [tab, page, query, isLogged]);

  const cards: BoardCard[] = useMemo(
    () =>
      boards.map((board) => ({
        name: board.name,
        image: board.image,
        color: rarityColor(board.rarity),
        fansLabel:
          board.fanCount === 0
            ? i18n.t("fandom.noFansYet")
            : i18n.t(board.fanCount === 1 ? "fandom.fansCountOne" : "fandom.fansCount", {
                count: board.fanCount,
              }),
        holder: board.top && board.topCount > 0 ? board.top.username : null,
        holderId: board.top && board.topCount > 0 ? board.top.userId : null,
        holderPicture: board.top ? board.top.profilePicture : "",
        count: board.topCount,
        contested: board.fanCount >= 3,
      })),
    [boards]
  );

  const reachCards: ReachCard[] = useMemo(
    () =>
      reach.map((row) => ({
        name: row.name,
        image: row.image,
        color: rarityColor(row.rarity),
        caseId: row.caseId,
        mine: row.mine,
        leader: row.leader,
        headline: row.holding ? i18n.t("fandom.yours") : String(row.behind),
        headlineLabel: row.holding ? i18n.t("fandom.holding") : i18n.t("fandom.behind"),
        standing: row.holding
          ? i18n.t("fandom.youLeadThisBoard")
          : row.leaderName
          ? i18n.t("fandom.leaderHolds", { name: row.leaderName, count: row.leader })
          : i18n.t("fandom.nobodyHoldsIt"),
        pct: row.leader > 0 ? Math.min(100, Math.round((row.mine / row.leader) * 100)) : 100,
        claimable: !row.holding && row.behind === 0,
      })),
    [reach]
  );

  return {
    tab,
    tabs: TABS,
    selectTab,
    search,
    setSearch,
    loading,
    cards,
    reachCards,
    collectors,
    characterCount,
    page,
    totalPages,
    goToPage,
    isLogged,
    signIn: toogleUserFlow,
  };
};
