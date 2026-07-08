import { useEffect, useState } from "react";
import { rarityColor } from "../../../utils/rarity";
import { BattleItem } from "../../../services/battles/BattleService";
import { BattleReelProps } from "./BattleReel.types";

const ITEM_H = 140; // height of one reel cell in px (fits the 128px images)
const WINDOW_CELLS = 3; // visible cells in the window
const REEL_LEN = 44; // total cells on the strip
const WIN_INDEX = 38; // where the winning item is planted

export const useBattleReel = ({ pool, winner, durationMs }: BattleReelProps) => {
  // build the strip once per mount (the reel is remounted via key for each round),
  // so a later prop-identity change (e.g. battle:finished) can't restart the spin
  const [{ strip, target }] = useState(() => {
    const src = pool && pool.length ? pool : [winner];
    const items: BattleItem[] = [];
    for (let i = 0; i < REEL_LEN; i++) {
      items.push(src[Math.floor(Math.random() * src.length)]);
    }
    items[WIN_INDEX] = winner;
    const cells = items.map((it) => ({
      image: it.image,
      name: it.name,
      color: rarityColor(it.rarity),
    }));

    // center the winning cell under the marker, nudged a little for realism
    const jitter = (Math.random() - 0.5) * ITEM_H * 0.5;
    const center = (WINDOW_CELLS - 1) / 2;
    return { strip: cells, target: (center - WIN_INDEX) * ITEM_H - jitter };
  });

  const [ty, setTy] = useState(0);
  useEffect(() => {
    // paint the resting strip first, then transition so the animation fires
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setTy(target)));
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return {
    strip,
    ty,
    durationMs,
    cellHeight: ITEM_H,
    windowHeight: ITEM_H * WINDOW_CELLS,
  };
};
