import { useCallback, useContext, useEffect, useRef, useState } from "react";
import UserContext from "../../../UserContext";
import {
  getBoard,
  getPoints,
  getMyLastBoard,
  Board,
  PointsGame,
  BoardResult,
} from "../../../services/leaderboard/LeaderboardService";
import { Countdown } from "./Leaderboard.types";

// the board only moves when someone bets, so it is polled rather than pushed. thirty
// seconds keeps a busy evening well inside the fifteen-second server-side cache.
const REFRESH_MS = 30000;
const ZERO: Countdown = { hours: "00", minutes: "00", seconds: "00" };

const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

// remaining time split into a countdown, from a millisecond gap
export const splitRemaining = (ms: number): Countdown => {
  if (!(ms > 0)) return ZERO;
  const total = Math.floor(ms / 1000);
  return {
    hours: pad(total / 3600),
    minutes: pad((total % 3600) / 60),
    seconds: pad(total % 60),
  };
};

// the podium is drawn 2nd, 1st, 3rd, so the winner stands in the middle. a board with
// fewer than three finishers renders whoever is there rather than crashing on a gap,
// which is what the old leaderboard did.
export const podiumOrder = <T,>(rows: T[]): T[] => {
  if (rows.length >= 3) return [rows[1], rows[0], rows[2]];
  if (rows.length === 2) return [rows[1], rows[0]];
  return rows.slice(0, 1);
};

export const useLeaderboardServices = () => {
  const { isLogged } = useContext(UserContext);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<Countdown>(ZERO);
  const [points, setPoints] = useState<PointsGame[]>([]);
  const [showPoints, setShowPoints] = useState(false);
  const [lastResult, setLastResult] = useState<BoardResult | null>(null);
  // the device clock can be wrong by minutes; the countdown runs off the server's instead
  const skew = useRef(0);
  const endsAt = useRef(0);
  const rolledOver = useRef(false);

  const load = useCallback(async () => {
    try {
      const next = await getBoard();
      skew.current = Date.now() - new Date(next.serverTime).getTime();
      endsAt.current = new Date(next.endsAt).getTime();
      rolledOver.current = false;
      setBoard(next);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!board) return;
    const tick = () => {
      const remaining = endsAt.current - (Date.now() - skew.current);
      setCountdown(splitRemaining(remaining));
      // the day turned over: pull the new board once rather than every second
      if (remaining <= 0 && !rolledOver.current) {
        rolledOver.current = true;
        load();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [board, load]);

  useEffect(() => {
    if (!isLogged) {
      setLastResult(null);
      return;
    }
    getMyLastBoard().then(setLastResult).catch(() => setLastResult(null));
  }, [isLogged]);

  const openPoints = useCallback(() => {
    setShowPoints(true);
    // fetched from the server so the table and the scoring can never disagree
    if (!points.length) getPoints().then((r) => setPoints(r.games)).catch(() => undefined);
  }, [points.length]);

  const standings = board ? board.standings : [];
  const me = board ? board.me : null;

  return {
    loading,
    board,
    podium: podiumOrder(standings),
    rest: standings.slice(3),
    countdown,
    pool: board ? board.pool : 0,
    me,
    paidPlaces: board ? board.paidPlaces : 0,
    meOnBoard: !!me && !!me.rank && me.rank <= (board ? board.paidPlaces : 0),
    lastResult,
    dismissResult: () => setLastResult(null),
    points,
    showPoints,
    openPoints,
    closePoints: () => setShowPoints(false),
  };
};
