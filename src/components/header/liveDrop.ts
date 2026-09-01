import { BasicItem } from "../Types";

// 95% of openings are five at once, so showing every item would put five cards in a feed
// that holds twenty and let one player fill it. one card per opening instead, carrying the
// rarest pull, which is the part anyone reads the feed for. ties keep the first rolled.
export const bestDrop = (items: BasicItem[]): BasicItem | undefined =>
  (items || []).reduce<BasicItem | undefined>(
    (best, item) => (!best || Number(item.rarity) > Number(best.rarity) ? item : best),
    undefined
  );

// the strip holds the last few openings and nothing else takes them off it. a drop leaves
// only when newer ones push it past the end, so a quiet minute leaves the bar exactly as it
// was rather than emptying it. it is a local list: a reload starts it over.
export const KEEP_DROPS = 20;

export const pushDrop = <T,>(drops: T[], drop: T, keep = KEEP_DROPS) =>
  [drop, ...drops].slice(0, keep);
