import { BasicItem } from "../Types";

// 95% of openings are five at once, so showing every item would put five cards in a feed
// that holds twenty and let one player fill it. one card per opening instead, carrying the
// rarest pull, which is the part anyone reads the feed for. ties keep the first rolled.
export const bestDrop = (items: BasicItem[]): BasicItem | undefined =>
  (items || []).reduce<BasicItem | undefined>(
    (best, item) => (!best || Number(item.rarity) > Number(best.rarity) ? item : best),
    undefined
  );
