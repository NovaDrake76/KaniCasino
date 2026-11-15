// client mirror of backend/utils/lotteryMath.js: the same rules, so the slip and the game info quote what the server
// settles. change one and the other has to follow; both sides test the same numbers.
export const POOL = 20;
export const PICK = 3;
export const PRICE = 100;
export const CAP = 50;
export const DRAW_HOUR_UTC = 20;
export const SALES_CLOSE_MS = 60 * 1000;
export const PRIZES: Record<number, number> = { 1: 100, 2: 300 };
export const JACKPOT_BASE = 25000;
export const JACKPOT_SHARE = 25;
export const POINTS_PER_KP = 1.3;
export const QUICK_MANY = [5, 10];

export const NUMBERS = Array.from({ length: POOL }, (_, i) => i + 1);

export const choose = (n: number, k: number) => {
  if (k < 0 || k > n) return 0;
  let out = 1;
  for (let i = 1; i <= k; i++) out = (out * (n - k + i)) / i;
  return Math.round(out);
};

export const COMBINATIONS = choose(POOL, PICK);
export const waysToMatch = (k: number) => choose(PICK, k) * choose(POOL - PICK, PICK - k);
export const FIXED_RTP = [1, 2].reduce((sum, k) => sum + waysToMatch(k) * PRIZES[k], 0) / (COMBINATIONS * PRICE);

// the n in "1 in n": one decimal while it is small, whole and grouped once it is not
export const oneIn = (k: number) => {
  const n = COMBINATIONS / waysToMatch(k);
  return n < 100 ? n.toLocaleString("en-US", { maximumFractionDigits: 1 }) : Math.round(n).toLocaleString("en-US");
};

export const sortPick = (pick: number[]) => [...pick].sort((a, b) => a - b);

// a tap picks a number, a second tap unpicks it, and a fourth pick does nothing until one is let go
export const togglePick = (pick: number[], n: number): number[] => {
  if (pick.includes(n)) return pick.filter((x) => x !== n);
  if (pick.length >= PICK || n < 1 || n > POOL) return pick;
  return [...pick, n];
};

// three distinct numbers from 1 to 20, a partial shuffle like the draw's own
export const quickPick = (random: () => number = Math.random): number[] => {
  const pool = [...NUMBERS];
  for (let i = 0; i < PICK; i++) {
    const j = i + Math.floor(random() * (POOL - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return sortPick(pool.slice(0, PICK));
};

// how many more tickets fit: the cap less what the player holds and what is already on the slip
export const slipRoom = (held: number, slip: number) => Math.max(0, CAP - held - slip);

export const addToSlip = (slip: number[][], pick: number[], held: number): number[][] =>
  pick.length === PICK && slipRoom(held, slip.length) > 0 ? [...slip, sortPick(pick)] : slip;

export const addQuickPicks = (slip: number[][], count: number, held: number, random: () => number = Math.random): number[][] => [
  ...slip,
  ...Array.from({ length: Math.min(count, slipRoom(held, slip.length)) }, () => quickPick(random)),
];

// the last draw's tickets again, in their order and duplicates kept, as many as the cap still has room for
export const repeatTickets = (slip: number[][], tickets: number[][], held: number): number[][] => [
  ...slip,
  ...tickets.slice(0, slipRoom(held, slip.length)).map(sortPick),
];

export const removeFromSlip = (slip: number[][], index: number) => slip.filter((_, i) => i !== index);

export const slipTotal = (slip: number[][]) => slip.length * PRICE;

export const matchedIn = (pick: number[], numbers: number[]) => pick.filter((n) => numbers.includes(n)).length;

const pad = (n: number) => String(n).padStart(2, "0");

// hours, minutes and seconds to go, never below zero
export const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

// the draw time on the viewer's clock, from the hour it is held at in utc
export const localDrawTime = (locale: string, hourUtc = DRAW_HOUR_UTC, today: Date = new Date()) => {
  const at = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hourUtc, 0, 0));
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(at);
};

// the same text Monetary renders, for the labels the hook hands over as finished strings
export const kpText = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "DOL", maximumFractionDigits: 0 }).format(n).replace("DOL", "K₽");
