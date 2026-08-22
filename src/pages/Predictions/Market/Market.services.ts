import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../../UserContext";
import SocketConnection from "../../../services/socket";
import { OUTCOME_COLORS } from "../../../components/outcomeColors";
import {
  getMarket,
  getMarketHistory,
  getMarketTrades,
  quoteTrade,
  placeTrade,
  Market,
  MarketTrade,
  PriceSeries,
  Quote,
  messageOf,
} from "../../../services/predictions/PredictionService";
import { TradeAction } from "./Market.types";
import i18n from "../../../i18n";

const QUOTE_DEBOUNCE_MS = 250;

export const useMarketServices = () => {
  const { slug = "" } = useParams();
  const { userData, toogleUserFlow } = useContext(UserContext);

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [series, setSeries] = useState<PriceSeries[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [trades, setTrades] = useState<MarketTrade[]>([]);

  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState<TradeAction>("buy");
  const [sharesInput, setSharesInput] = useState("10");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const shares = Math.max(0, Math.floor(Number(sharesInput) || 0));
  const isLogged = userData != null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    getMarket(slug)
      .then((data) => {
        if (!active) return;
        setMarket(data);
        setSelected((prev) => prev || (data.outcomes[0] ? data.outcomes[0].key : null));
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;
    setLoadingSeries(true);
    getMarketHistory(slug)
      .then((data) => active && setSeries(data))
      .catch(() => active && setSeries([]))
      .finally(() => active && setLoadingSeries(false));
    getMarketTrades(slug)
      .then((data) => active && setTrades(data))
      .catch(() => active && setTrades([]));
    return () => {
      active = false;
    };
  }, [slug]);

  // somebody else's trade moves the prices on the page without a refetch, and the chart
  // grows a point so the line keeps up with the number above it
  useEffect(() => {
    const socket = SocketConnection.getInstance();
    const onUpdate = (payload: { slug: string; outcomes: { key: string; priceBps: number; volume: number }[] }) => {
      if (payload.slug !== slug) return;
      setMarket((prev) =>
        prev
          ? {
              ...prev,
              outcomes: prev.outcomes.map((outcome) => {
                const moved = payload.outcomes.find((o) => o.key === outcome.key);
                return moved ? { ...outcome, priceBps: moved.priceBps, volume: moved.volume } : outcome;
              }),
            }
          : prev
      );
      const at = new Date().toISOString();
      setSeries((prev) =>
        prev.map((line) => {
          const moved = payload.outcomes.find((o) => o.key === line.key);
          return moved ? { ...line, points: [...line.points, { at, priceBps: moved.priceBps }] } : line;
        })
      );
    };
    socket.on("predictionUpdated", onUpdate);
    return () => {
      socket.off("predictionUpdated", onUpdate);
    };
  }, [slug]);

  const heldOf = (key: string) => {
    const outcome = market ? market.outcomes.find((o) => o.key === key) : null;
    return outcome ? outcome.shares : 0;
  };

  const avgOf = (key: string) => {
    const outcome = market ? market.outcomes.find((o) => o.key === key) : null;
    return outcome ? outcome.avgPriceBps : 0;
  };

  const colorOf = useMemo(() => {
    const byKey = new Map((market ? market.outcomes : []).map((o, i) => [o.key, OUTCOME_COLORS[i % OUTCOME_COLORS.length]]));
    return (key: string) => byKey.get(key) || OUTCOME_COLORS[0];
  }, [market]);

  // the quote is the server's, not a local guess: what it says is what the fill charges
  const quoteSeq = useRef(0);
  useEffect(() => {
    if (!isLogged || !selected || shares <= 0 || !market || market.status !== "open") {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    const timer = setTimeout(() => {
      quoteTrade(slug, selected, action, shares)
        .then((data) => {
          if (seq !== quoteSeq.current) return;
          setQuote(data);
          setQuoteError(null);
        })
        .catch((error) => {
          if (seq !== quoteSeq.current) return;
          setQuote(null);
          setQuoteError(messageOf(error, i18n.t("predictions.couldNotQuote")));
        })
        .finally(() => {
          if (seq === quoteSeq.current) setQuoting(false);
        });
    }, QUOTE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [slug, selected, action, shares, isLogged, market]);

  const submit = async () => {
    if (!isLogged) return toogleUserFlow(true);
    if (!selected || shares <= 0 || submitting) return;

    setSubmitting(true);
    try {
      const result = await placeTrade(slug, selected, action, shares);
      setMarket(result.prediction);
      if (result.walletBalance !== undefined && userData) userData.walletBalance = result.walletBalance;
      toast.success(
        action === "buy"
          ? i18n.t("predictions.bought", { count: shares, amount: result.spent })
          : i18n.t("predictions.sold", { count: shares, amount: result.received }),
        { theme: "dark" }
      );
      getMarketTrades(slug).then(setTrades).catch(() => undefined);
      getMarketHistory(slug).then(setSeries).catch(() => undefined);
    } catch (error) {
      toast.error(messageOf(error, i18n.t("predictions.tradeFailed")), { theme: "dark" });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    market,
    loading,
    notFound,
    series,
    loadingSeries,
    trades,
    isLogged,
    walletBalance: userData?.walletBalance ?? 0,
    selected,
    select: (key: string) => setSelected(key),
    action,
    setAction: (next: TradeAction) => {
      setAction(next);
      // switching to sell with more shares typed than are held only ever quotes an error
      if (next === "sell" && selected) {
        const held = heldOf(selected);
        if (held > 0 && shares > held) setSharesInput(String(held));
      }
    },
    sharesInput,
    setSharesInput,
    shares,
    quote,
    quoting,
    quoteError,
    submitting,
    submit,
    setMaxShares: () => selected && setSharesInput(String(heldOf(selected))),
    bumpShares: (by: number) => setSharesInput(String(Math.max(1, shares + by))),
    heldOf,
    avgOf,
    colorOf,
  };
};
