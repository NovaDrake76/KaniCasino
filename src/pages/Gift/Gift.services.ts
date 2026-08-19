import type { BasicItem } from "../../components/Types";
import type { GiftSlot } from "./Gift.types";

export const kp = (n: number) => Math.round(n).toLocaleString("en-US");

// 1.12 reads as 1.1x, 2 as 2x: the trailing zero makes it look like a price
export const boost = (n: number) => `${Number(n.toFixed(1))}x`;

export function countdown(until?: string | null, now: number = Date.now()): string {
  if (!until) return "";
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return "";
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// the shared Roulette renders BasicItems, so a prize slot borrows that shape: the case art
// is the picture and the slot's rank becomes the rarity colour on its bottom border
const asItem = (slot: GiftSlot, rank: number, key: string): BasicItem => ({
  case: slot.caseId,
  image: slot.image,
  name: `${slot.opens}x ${slot.title}`,
  rarity: Math.min(5, rank + 1),
  _id: slot.caseId,
  uniqueId: key,
});

export const reelItems = (slots: GiftSlot[], landing?: BasicItem | null): BasicItem[] => {
  const faces = slots.map((s, i) => asItem(s, i, `slot-${i}`));
  return landing ? [landing, ...faces] : faces;
};

export const wonItem = (slots: GiftSlot[], caseId: string, opens: number): BasicItem => {
  const rank = Math.max(0, slots.findIndex((s) => s.caseId === caseId && s.opens === opens));
  const slot = slots[rank] || slots[0];
  return asItem({ ...slot, opens }, rank, "won");
};

// the streak's effect, stated as the odds it moves rather than a raw tilt number
export const chargedRungs = (
  rungs: { multiplier: number; chance: number; locked: boolean; minLevel: number }[]
) => rungs.filter((r) => !r.locked);
