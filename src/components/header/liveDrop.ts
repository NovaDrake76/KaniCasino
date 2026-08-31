import { BasicItem } from "../Types";

// 95% of openings are five at once, so showing every item would put five cards in a feed
// that holds twenty and let one player fill it. one card per opening instead, carrying the
// rarest pull, which is the part anyone reads the feed for. ties keep the first rolled.
export const bestDrop = (items: BasicItem[]): BasicItem | undefined =>
  (items || []).reduce<BasicItem | undefined>(
    (best, item) => (!best || Number(item.rarity) > Number(best.rarity) ? item : best),
    undefined
  );

// how long a drop stays on the live strip. it used to stay for the rest of the session,
// so one case opened at any point held the strip's 112px open on every page after it,
// game boards included. long enough to be seen, short enough to give the space back.
export const DROP_TTL_MS = 45000;

export const isFreshDrop = (drop: { at?: number }, now = Date.now()) =>
  now - (drop.at || 0) < DROP_TTL_MS;

// the strip is live while its newest drop is, and then it goes entirely. expiring the rows
// one at a time emptied it from the tail while new ones still arrived at the head, so the
// feed sat half filled with a stretch of bare background to the right of it. the row it
// draws is full width, so it either fills or it is not there.
export const freshDrops = <T extends { at?: number }>(drops: T[], now = Date.now()) =>
  drops.length && isFreshDrop(drops[0], now) ? drops : [];
