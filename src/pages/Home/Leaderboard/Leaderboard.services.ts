import { useCallback, useEffect, useState } from "react";
import { getPoints, PointsGame } from "../../../services/leaderboard/LeaderboardService";
import { useHomeBoard } from "../HomeFeed/HomeFeed.context";
import { Countdown } from "./Leaderboard.types";

// the section's anchor, so the today strip can bring it into view
export const LEADERBOARD_ID = "leaderboard";
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
  // polled once for the whole home page (HomeFeed), so the today strip and this section never ask twice
  const { board, status, skew } = useHomeBoard();
  const [countdown, setCountdown] = useState<Countdown>(ZERO);
  const [points, setPoints] = useState<PointsGame[]>([]);
  const [showPoints, setShowPoints] = useState(false);

  // the device clock can be wrong by minutes; the countdown runs off the server's instead
  useEffect(() => {
    if (!board) return;
    const endsAt = new Date(board.endsAt).getTime();
    const tick = () => setCountdown(splitRemaining(endsAt - (Date.now() - skew)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [board, skew]);

  const openPoints = useCallback(() => {
    setShowPoints(true);
    // fetched from the server so the table and the scoring can never disagree
    if (!points.length) getPoints().then((r) => setPoints(r.games)).catch(() => undefined);
  }, [points.length]);

  const standings = board ? board.standings : [];
  // the podium is for players who actually scored. the padded seats fill the table below
  // it, so a board with one real player shows one plinth rather than three strangers.
  const earned = standings.filter((row) => !row.placeholder);
  const me = board ? board.me : null;

  return {
    loading: status === "loading",
    board,
    sectionId: LEADERBOARD_ID,
    podium: podiumOrder(earned.slice(0, 3)),
    rest: standings.slice(Math.min(earned.length, 3)),
    // the podium only stands first place on mobile, so second and third join the table
    // there rather than disappearing off the board entirely
    podiumRest: earned.slice(1, 3),
    countdown,
    pool: board ? board.pool : 0,
    me,
    paidPlaces: board ? board.paidPlaces : 0,
    meOnBoard: !!me && !!me.rank && me.rank <= (board ? board.paidPlaces : 0),
    points,
    showPoints,
    openPoints,
    closePoints: () => setShowPoints(false),
  };
};
