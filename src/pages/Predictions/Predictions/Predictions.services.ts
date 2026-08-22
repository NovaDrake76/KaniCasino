import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listMarkets, Market, MarketUpdate } from "../../../services/predictions/PredictionService";
import SocketConnection from "../../../services/socket";
import { StatusFilter } from "./Predictions.types";

export const usePredictionsServices = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "All");
  const [status, setStatus] = useState<StatusFilter>((searchParams.get("status") as StatusFilter) || "open");
  const navigate = useNavigate();

  // the filters live in the url so a board someone is looking at can be linked to
  useEffect(() => {
    const next: Record<string, string> = {};
    if (search) next.q = search;
    if (category !== "All") next.category = category;
    if (status !== "open") next.status = status;
    setSearchParams(next, { replace: true });
  }, [search, category, status, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [search, category, status]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      listMarkets({
        page,
        q: search || undefined,
        category: category === "All" ? undefined : category,
        status: status === "all" ? undefined : status,
      })
        .then((data) => {
          if (!active) return;
          setMarkets(data.predictions);
          setTotalPages(data.totalPages);
          setCategories(data.categories);
        })
        .catch(() => active && setMarkets([]))
        .finally(() => active && setLoading(false));
    }, search ? 300 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, search, category, status]);

  // a price that moved somewhere else on the site should move here too, without a refetch
  useEffect(() => {
    const socket = SocketConnection.getInstance();
    const onUpdate = (payload: MarketUpdate) => {
      setMarkets((prev) =>
        prev.map((market) =>
          market.slug !== payload.slug
            ? market
            : {
                ...market,
                volume: payload.volume,
                traders: payload.traders,
                outcomes: market.outcomes.map((outcome) => {
                  const moved = payload.outcomes.find((o) => o.key === outcome.key);
                  return moved ? { ...outcome, priceBps: moved.priceBps, volume: moved.volume } : outcome;
                }),
              }
        )
      );
    };
    socket.on("predictionUpdated", onUpdate);
    return () => {
      socket.off("predictionUpdated", onUpdate);
    };
  }, []);

  return {
    markets,
    loading,
    categories,
    category,
    setCategory,
    status,
    setStatus,
    search,
    setSearch,
    page,
    totalPages,
    setPage,
    openMarket: (slug: string) => navigate(`/predictions/${slug}`),
  };
};
