import { useEffect, useRef, useState } from "react";
import { BattlePlayer } from "../../../services/battles/BattleService";
import { TieBreakerProps } from "./TieBreaker.types";

const CELL_W = 96; // width of one avatar cell in px
const REEL_LEN = 44; // total cells on the strip
const WIN_INDEX = 38; // where the winning player is planted
const FALLBACK_AVATAR = "https://i.imgur.com/uUfJSwW.png";

export const useTieBreaker = ({ players, winner, durationMs }: TieBreakerProps) => {
  const windowRef = useRef<HTMLDivElement | null>(null);

  // build the strip once per mount so a re-render can't restart the spin
  const [strip] = useState(() => {
    const src = players.length ? players : [winner];
    const cells: BattlePlayer[] = [];
    for (let i = 0; i < REEL_LEN; i++) {
      cells.push(src[Math.floor(Math.random() * src.length)]);
    }
    cells[WIN_INDEX] = winner;
    return cells;
  });

  const [tx, setTx] = useState(0);
  useEffect(() => {
    // center the winning cell under the marker (measured against the window)
    const width = windowRef.current?.clientWidth ?? 600;
    const winnerCenter = WIN_INDEX * CELL_W + CELL_W / 2;
    const dest = width / 2 - winnerCenter;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setTx(dest)));
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    windowRef,
    strip,
    tx,
    durationMs,
    cellWidth: CELL_W,
    fallbackAvatar: FALLBACK_AVATAR,
  };
};
