import type { PickGame } from "../../services/daisu/DaisuService";

// mirrors backend/utils/pot.js so the jar can tick between requests; the server prices
// every take itself, so a drift here can only ever mislabel a number
const CLICK_RATE = 0.8;

export const fillAt = (fullAt: string, cycleMs: number, now: number) => {
  const startedAt = new Date(fullAt).getTime() - cycleMs;
  return Math.max(0, Math.min(1, (now - startedAt) / cycleMs));
};

export const payout = (full: number, fill: number) =>
  Math.floor(full * fill * (CLICK_RATE + (1 - CLICK_RATE) * fill));

// what one more click takes: the cumulative curve between the last click and now, so
// a run of clicks adds up to exactly what the server pays when it settles the run
export const takeBetween = (full: number, lastFill: number, fill: number) =>
  Math.max(0, payout(full, fill) - payout(full, lastFill));

// ms until the pot reaches this fill, zero when it already has
export const msUntil = (fullAt: string, cycleMs: number, fill: number, now: number) =>
  Math.max(0, new Date(fullAt).getTime() - cycleMs * (1 - fill) - now);

// the lines she speaks carry amounts as text, with the same non-breaking space after the
// sign that the wallet's currency format puts there
const NBSP = String.fromCharCode(160);
export const kp = (n: number) => `K₽${NBSP}${Math.floor(n).toLocaleString("en-US")}`;

export const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const GAME_PATHS: Record<PickGame, string> = {
  slots: "/slot",
  dice: "/dice",
  plinko: "/plinko",
  mines: "/mines",
  blackjack: "/blackjack",
  hilo: "/hilo",
};

// the names the navbar already uses, so the pick reads the same everywhere
export const GAME_NAME_KEYS: Record<PickGame, string> = {
  slots: "nav.slots",
  dice: "dice.dice",
  plinko: "nav.plinko",
  mines: "mines.mines",
  blackjack: "blackjack.blackjack",
  hilo: "hilo.hilo",
};
