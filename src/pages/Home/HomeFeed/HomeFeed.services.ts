import { useCallback, useEffect, useRef, useState } from "react";
import SocketConnection from "../../../services/socket";
import { getLotteryPot, DrawnEvent, LotteryPot, PotUpdate } from "../../../services/lottery/LotteryService";
import { getBoard } from "../../../services/leaderboard/LeaderboardService";
import { BOARD_LOADING, POT_LOADING } from "./HomeFeed.context";
import { BoardFeed, PotFeed } from "./HomeFeed.types";

// the board only moves when someone bets, so it is polled rather than pushed. thirty
// seconds keeps a busy evening well inside the fifteen-second server-side cache.
export const BOARD_REFRESH_MS = 30000;
// the draw's clock ran out and the socket said nothing: the lottery page's own wait, then a backoff up to the draw sweep's five minutes
export const LATE_AFTER_MS = 15000;
export const LATE_POLL_MS = 20000;
export const LATE_MAX_MS = 5 * 60 * 1000;

export const lateDelay = (attempt: number) => Math.min(LATE_POLL_MS * 2 ** Math.max(0, attempt - 1), LATE_MAX_MS);

export const skewOf = (iso?: string | null): number | null => {
  const at = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(at) ? Date.now() - at : null;
};

export const potOf = (data: unknown): LotteryPot | null => {
  const pot = data as LotteryPot | null;
  return pot && Number.isInteger(pot.number) && typeof pot.jackpot === "number" ? pot : null;
};

// draws only move forward and a pot only grows inside one, so of two answers the larger is the newer, whichever lands last
export const freshest = (held: LotteryPot | null, incoming: LotteryPot | null): LotteryPot | null => {
  if (!held || !incoming) return incoming || held;
  if (incoming.number !== held.number) return incoming.number > held.number ? incoming : held;
  return incoming.jackpot >= held.jackpot ? incoming : held;
};

// the open draw's pot: one read when the home page opens, then the live events the lottery page follows
export const usePotFeed = (): PotFeed => {
  const [feed, setFeed] = useState<PotFeed>(POT_LOADING);
  const skew = useRef(0);
  skew.current = feed.skew;

  const take = useCallback((data: unknown) => {
    const incoming = potOf(data);
    const at = skewOf(incoming && incoming.serverTime);
    setFeed((prev) => ({ status: "ready", pot: freshest(prev.pot, incoming), skew: at ?? prev.skew }));
  }, []);

  useEffect(() => {
    let alive = true;
    getLotteryPot()
      .then((data) => {
        if (alive) take(data);
      })
      .catch(() => {
        if (alive) setFeed((prev) => (prev.status === "loading" ? { ...prev, status: "failed" } : prev));
      });
    const socket = SocketConnection.getInstance();
    const onPot = (update: PotUpdate) =>
      setFeed((prev) => {
        if (!prev.pot || prev.pot.number !== update.draw) return prev;
        const pot = freshest(prev.pot, { ...prev.pot, jackpot: update.jackpot });
        return pot === prev.pot ? prev : { ...prev, pot };
      });
    const onDrawn = (drawn: DrawnEvent) =>
      setFeed((prev) => {
        if (!drawn.next) return prev;
        const pot = freshest(prev.pot, { number: drawn.next.number, jackpot: drawn.next.jackpot, drawAt: drawn.next.drawAt });
        return pot === prev.pot ? prev : { ...prev, status: "ready", pot };
      });
    socket.on("lottery:pot", onPot);
    socket.on("lottery:drawn", onDrawn);
    return () => {
      alive = false;
      socket.off("lottery:pot", onPot);
      socket.off("lottery:drawn", onDrawn);
    };
  }, [take]);

  // a missed lottery:drawn must not leave the strip at 00:00:00 on a draw that has happened; a new number ends this
  const number = feed.pot ? feed.pot.number : null;
  const drawAt = feed.pot ? feed.pot.drawAt : null;
  useEffect(() => {
    if (number === null || drawAt === null) return;
    let alive = true;
    let attempt = 0;
    let timer: number | undefined;
    const ask = () => {
      getLotteryPot()
        .then((data) => {
          if (alive) take(data);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!alive) return;
          attempt += 1;
          timer = window.setTimeout(ask, lateDelay(attempt));
        });
    };
    const left = Date.parse(drawAt) - (Date.now() - skew.current);
    timer = window.setTimeout(ask, Math.max(0, left) + LATE_AFTER_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [number, drawAt, take]);

  return feed;
};

// today's board for the strip and the leaderboard section: one poller for both
export const useBoardFeed = (): BoardFeed => {
  const [feed, setFeed] = useState<BoardFeed>(BOARD_LOADING);
  const skew = useRef(0);
  skew.current = feed.skew;

  const load = useCallback(async () => {
    try {
      const board = await getBoard();
      setFeed({ status: "ready", board, skew: skewOf(board.serverTime) ?? 0 });
    } catch (err) {
      console.error(err);
      setFeed((prev) => (prev.status === "loading" ? { ...prev, status: "failed" } : prev));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, BOARD_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // the day turned over: pull the new board once at the reset rather than wait out the poll
  const endsAt = feed.board ? feed.board.endsAt : null;
  useEffect(() => {
    if (!endsAt) return;
    const left = Date.parse(endsAt) - (Date.now() - skew.current);
    if (!(left > 0)) return;
    const timer = window.setTimeout(load, left);
    return () => window.clearTimeout(timer);
  }, [endsAt, load]);

  return feed;
};
