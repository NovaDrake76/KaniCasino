import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../../UserContext";
import {
  CashOutOptions,
  getCashOutOptions,
  getSocket,
  getStakeable,
  StakeableItem,
  leaveTable,
  sendAction,
  sitDown,
  unwatchTable,
  watchTable,
} from "../../../services/poker/PokerService";

import { ActionFeedEntry, LegalAction, ShowdownSummary, TableServices, ViewTable } from "./Table.types";
import i18n from "../../../i18n";

const FEED_KEPT = 6;

// the hero always sits at the bottom of the table, whatever seat they actually hold, so
// the render order is rotated rather than the data
export const rotate = (seatCount: number, hero: number | null) => {
  const order = Array.from({ length: seatCount }, (_, i) => i);
  if (hero === null || hero < 0) return order;
  return order.map((_, i) => (hero + i) % seatCount);
};

export const useTableServices = (): TableServices => {
  const { slug } = useParams();
  const { isLogged, toogleUserFlow } = useContext(UserContext);

  const [table, setTable] = useState<ViewTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<ActionFeedEntry[]>([]);
  const [showdown, setShowdown] = useState<ShowdownSummary | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [acting, setActing] = useState(false);

  const [buyInSeat, setBuyInSeat] = useState<number | null>(null);
  const [buyInItems, setBuyInItems] = useState<StakeableItem[]>([]);
  const [buyInLoading, setBuyInLoading] = useState(false);

  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [cashOut, setCashOut] = useState<CashOutOptions | null>(null);

  const feedId = useRef(0);
  const tableId = table?._id;

  useEffect(() => {
    if (!slug) return;
    let live = true;
    const socket = getSocket();

    const open = async () => {
      const res = await watchTable(slug);
      if (!live) return;
      if (res.error || !res.table) {
        setError(res.error || i18n.t("poker.tableGone"));
        setLoading(false);
        return;
      }
      setTable(res.table as ViewTable);
      setLoading(false);
    };

    const onState = (next: ViewTable) => live && setTable(next);
    const onAction = (entry: Omit<ActionFeedEntry, "id">) => {
      if (!live) return;
      feedId.current += 1;
      setFeed((prev) => [...prev, { ...entry, id: feedId.current }].slice(-FEED_KEPT));
    };
    const onHandStart = () => {
      if (!live) return;
      setFeed([]);
      setShowdown(null);
    };
    const onShowdown = (summary: ShowdownSummary) => live && setShowdown(summary);

    open();
    socket.on("poker:state", onState);
    socket.on("poker:action", onAction);
    socket.on("poker:handStart", onHandStart);
    socket.on("poker:showdown", onShowdown);
    socket.on("connect", open);

    return () => {
      live = false;
      socket.off("poker:state", onState);
      socket.off("poker:action", onAction);
      socket.off("poker:handStart", onHandStart);
      socket.off("poker:showdown", onShowdown);
      socket.off("connect", open);
      if (tableId) unwatchTable(tableId);
    };
    // the table id is only known after the first load, and the cleanup closes over it
    // deliberately; re-running on it would tear the subscription down mid-hand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // the clock is the server's; this only counts down what it already sent
  useEffect(() => {
    if (!table?.actionDeadline || table.toAct === null) {
      setSecondsLeft(null);
      return;
    }
    const deadline = new Date(table.actionDeadline).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [table?.actionDeadline, table?.toAct]);

  const heroSeat = table?.yourSeat ?? null;
  const order = useMemo(() => rotate(table?.seatCount || 6, heroSeat), [table?.seatCount, heroSeat]);
  const atRiskIds = useMemo(
    () => new Set((table?.atRisk || []).map((e) => e.uniqueId)),
    [table?.atRisk]
  );

  const openBuyIn = useCallback(
    (seat: number) => {
      if (!isLogged) return toogleUserFlow(true);
      setBuyInSeat(seat);
      setBuyInLoading(true);
      getStakeable()
        .then((data) => setBuyInItems(data.items || []))
        .catch(() => setBuyInItems([]))
        .finally(() => setBuyInLoading(false));
    },
    [isLogged, toogleUserFlow]
  );

  const submitBuyIn = useCallback(
    async (kp: number, uniqueIds: string[]) => {
      if (!table || buyInSeat === null) return;
      const res = await sitDown({ tableId: table._id, seat: buyInSeat, kp, uniqueIds });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(i18n.t("poker.satDown"));
      setBuyInSeat(null);
    },
    [table, buyInSeat]
  );

  const openCashOut = useCallback(async () => {
    if (!table) return;
    const res = await getCashOutOptions(table._id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setCashOut(res);
    setCashOutOpen(true);
  }, [table]);

  const submitCashOut = useCallback(
    async (picks: string[]) => {
      if (!table) return;
      const res = await leaveTable(table._id, picks);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setCashOutOpen(false);
      toast.success(res.queued ? i18n.t("poker.leavingAfterHand") : i18n.t("poker.cashedOut"));
    },
    [table]
  );

  const act = useCallback(
    (type: LegalAction["type"], to?: number) => {
      if (!table || acting) return;
      setActing(true);
      sendAction(table._id, type, to)
        .then((res) => res.error && toast.error(res.error))
        .finally(() => setActing(false));
    },
    [table, acting]
  );

  return {
    table,
    loading,
    error,
    isLogged,
    signIn: () => toogleUserFlow(true),
    order,
    heroSeat,
    secondsLeft,
    feed,
    showdown,
    atRiskIds,
    buyInSeat,
    openBuyIn,
    closeBuyIn: () => setBuyInSeat(null),
    buyInItems,
    buyInLoading,
    submitBuyIn,
    cashOutOpen,
    cashOut,
    openCashOut,
    closeCashOut: () => setCashOutOpen(false),
    submitCashOut,
    act,
    acting,
    pool: table?.pool || [],
  };
};
