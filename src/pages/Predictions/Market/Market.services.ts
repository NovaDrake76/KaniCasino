import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  MarketUpdate,
  PriceSeries,
  Quote,
  messageOf,
  isBinary,
  yesOutcome,
} from "../../../services/predictions/PredictionService";
import { Range, withinRange } from "../../../components/timeRange";
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
  const [range, setRange] = useState<Range>("ALL");

  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState<TradeAction>("buy");
  const [sharesInput, setSharesInput] = useState("10");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // which outcomes just moved, and which way, so a price changing under a reader is
  // something they see rather than something they have to have been watching for
  const [moved, setMoved] = useState<Record<string, "up" | "down">>({});

  const shares = Math.max(0, Math.floor(Number(sharesInput) || 0));
  const isLogged = userData != null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    getMarket(slug)
      .then((data) => {
        if (!active) return;
        data.outcomes.forEach((o) => { drawn.current[o.key] = o.priceBps; });
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

  // the last prices this page drew, kept in a ref rather than read back out of state: the
  // comparison has to happen before the update is applied, and a setState inside another
  // setState's updater is a side effect in the wrong place
  const drawn = useRef<Record<string, number>>({});

  const flash = useCallback((next: { key: string; priceBps: number }[]) => {
    const moves: Record<string, "up" | "down"> = {};
    for (const outcome of next) {
      const was = drawn.current[outcome.key];
      if (was !== undefined && was !== outcome.priceBps) {
        moves[outcome.key] = outcome.priceBps > was ? "up" : "down";
      }
      drawn.current[outcome.key] = outcome.priceBps;
    }
    if (Object.keys(moves).length === 0) return;
    setMoved(moves);
    setTimeout(() => setMoved({}), 1200);
  }, []);

  // one place that folds a live update in, so a fill of your own and somebody else's
  // arriving over the socket leave the page in the same state
  const applyUpdate = useCallback((payload: MarketUpdate) => {
    flash(payload.outcomes);
    setMarket((prev) =>
      prev
        ? {
            ...prev,
            volume: payload.volume,
            traders: payload.traders,
            outcomes: prev.outcomes.map((outcome) => {
              const update = payload.outcomes.find((o) => o.key === outcome.key);
              return update ? { ...outcome, priceBps: update.priceBps, volume: update.volume } : outcome;
            }),
          }
        : prev
    );

    const at = payload.trade ? payload.trade.createdAt : new Date().toISOString();
    setSeries((prev) =>
      prev.map((line) => {
        const moved = payload.outcomes.find((o) => o.key === line.key);
        return moved ? { ...line, points: [...line.points, { at, priceBps: moved.priceBps }] } : line;
      })
    );

    // the broadcast reaches the trader too, so the same fill must not land twice
    if (payload.trade) {
      setTrades((prev) =>
        prev.some((t) => t._id === payload.trade._id) ? prev : [payload.trade, ...prev].slice(0, 30)
      );
    }
  }, [flash]);

  // somebody else's trade moves the prices on the page without a refetch, and the chart
  // grows a point so the line keeps up with the number above it
  useEffect(() => {
    const socket = SocketConnection.getInstance();
    const onUpdate = (payload: MarketUpdate) => {
      if (payload.slug !== slug) return;
      applyUpdate(payload);
    };
    socket.on("predictionUpdated", onUpdate);
    return () => {
      socket.off("predictionUpdated", onUpdate);
    };
  }, [slug, applyUpdate]);

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
      // the shares held are the caller's own and only come back on the response; the prices
      // and the feed arrive for everybody over the socket, this tab included
      const result = await placeTrade(slug, selected, action, shares);
      flash(result.prediction.outcomes);
      setMarket(result.prediction);
      toast.success(
        action === "buy"
          ? i18n.t("predictions.bought", { count: shares, amount: result.spent })
          : i18n.t("predictions.sold", { count: shares, amount: result.received }),
        { theme: "dark" }
      );
    } catch (error) {
      toast.error(messageOf(error, i18n.t("predictions.tradeFailed")), { theme: "dark" });
    } finally {
      setSubmitting(false);
    }
  };

  const binary = market ? isBinary(market) : false;
  const yes = market && binary ? yesOutcome(market) : null;

  // a yes-or-no market draws one line. the No line is the same information upside down, and
  // two mirrored lines read as a chart with something going on in it when nothing is.
  const chartSeries = useMemo(() => {
    const shown = yes ? series.filter((line) => line.key === yes.key) : series;
    return shown.map((line) => ({ ...line, points: withinRange(line.points, range) }));
  }, [series, yes, range]);

  return {
    market,
    loading,
    notFound,
    series: chartSeries,
    loadingSeries,
    range,
    setRange,
    binary,
    chancePct: yes ? Math.round(yes.priceBps / 100) : null,
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
    movedOf: (key: string) => moved[key] || null,
  };
};
