// client mirror of backend/utils/scratchMath.js: the same prices and tables, so what the catalogue, the panel and the game
// info quote is exactly what the server settles. change one and the other has to follow; both sides test the same sums.
export type TicketId = "pocket" | "nine" | "treasure";

export const SLOTS = 1000000;
export const RTP = 0.96;
export const QUANTITIES = [1, 3, 5, 10];
// a prize this many times the price or more gets the big win overlay
export const BIG_WIN_MULTIPLIER = 25;

// match 3 in a line: [symbol, multiplier, slots]
export interface LineTicket {
  id: TicketId;
  kind: "line";
  price: number;
  prizes: [string, number, number][];
}

// lucky symbols: [slots, matched prizes in multiples of the price, multiplier]
export interface LuckyTicket {
  id: TicketId;
  kind: "lucky";
  price: number;
  pool: string[];
  printable: number[];
  lossMultipliers: number[];
  outcomes: [number, number[], number][];
}

// scratch 3 of 9: the finds in K₽, and [slots, the non-empty finds] per board
export interface PickTicket {
  id: TicketId;
  kind: "pick";
  price: number;
  picks: number;
  finds: [string, number][];
  boards: [number, number[]][];
}

export type Ticket = LineTicket | LuckyTicket | PickTicket;

// the rack, in the order the catalogue shows it; a new ticket is one more entry here and one in ticketLook.ts
export const TICKETS: Ticket[] = [
  {
    id: "pocket",
    kind: "line",
    price: 10,
    prizes: [["star", 1, 220000], ["clover", 2, 110000], ["coins", 5, 44000], ["gem", 10, 15000], ["chest", 25, 4000], ["crown", 100, 500]],
  },
  {
    id: "nine",
    kind: "lucky",
    price: 100,
    pool: ["nine", "snowflake", "frog", "star", "heart", "flame", "gem", "clover", "crown", "coins"],
    printable: [1, 2, 5, 10, 25, 50, 100, 1000],
    lossMultipliers: [1, 1, 1, 1, 2, 2, 3, 9],
    outcomes: [
      [199000, [1], 1], [50000, [2], 1], [20000, [1, 1], 1], [10000, [1], 2], [10000, [1], 3], [10000, [2, 1], 1],
      [14000, [5], 1], [10000, [2, 2, 1], 1], [10000, [1], 9], [5000, [10], 1], [3000, [5], 2], [2000, [2], 9],
      [2400, [25], 1], [600, [5], 9], [300, [100], 1], [200, [50], 2], [20, [100], 9], [60, [1000], 1],
    ],
  },
  {
    id: "treasure",
    kind: "pick",
    price: 1000,
    picks: 3,
    finds: [["hakkero", 100000], ["book", 10000], ["potion", 2500], ["star", 1000], ["mushroom", 500]],
    boards: [
      [254625, [500, 500]],
      [250000, [500, 500, 500]],
      [200000, [1000, 500, 500]],
      [155375, [1000, 1000, 500, 500]],
      [70000, [2500, 1000, 500]],
      [40000, [2500, 2500, 1000, 500, 500]],
      [20000, [10000, 1000, 500, 500]],
      [7000, [10000, 10000, 2500, 1000, 500]],
      [2500, [100000, 2500, 1000, 500]],
      [500, [100000, 100000, 100000, 10000, 2500]],
    ],
  },
];

export const ticketOf = (id: TicketId): Ticket => TICKETS.find((t) => t.id === id) || TICKETS[0];
export const isTicketId = (id: unknown): id is TicketId => TICKETS.some((t) => t.id === id);
export const quantitiesOf = (t: Ticket) => (t.kind === "pick" ? [1] : QUANTITIES);

const sum = (list: number[]) => list.reduce((s, n) => s + n, 0);
export const ninePays = ([, matched, multiplier]: [number, number[], number]) => multiplier * sum(matched);
const SPOTS = 9;

export const choose = (n: number, k: number) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};

// sum of (pays in multiples of the price) * slots; 960,000 is a 96% return. treasure counts what three picks take on average
export const returnSlots = (t: Ticket) => {
  if (t.kind === "line") return sum(t.prizes.map(([, m, slots]) => m * slots));
  if (t.kind === "lucky") return sum(t.outcomes.map((row) => ninePays(row) * row[0]));
  return (sum(t.boards.map(([slots, finds]) => slots * sum(finds))) * t.picks) / SPOTS / t.price;
};

// every way to choose k of n spots, in ascending order
const spotChoices = (n: number, k: number, from = 0): number[][] => {
  if (k === 0) return [[]];
  const out: number[][] = [];
  for (let c = from; c <= n - k; c++) for (const rest of spotChoices(n, k - 1, c + 1)) out.push([c, ...rest]);
  return out;
};

// what three spots pay against the price, over every board and every choice of three: [nothing, less, the price back, more],
// each out of choose(9, 3) x a million
export const payoutSplit = (t: PickTicket): [number, number, number, number] => {
  const split: [number, number, number, number] = [0, 0, 0, 0];
  const choices = spotChoices(SPOTS, t.picks);
  for (const [slots, finds] of t.boards) {
    const board = [...finds, ...Array(SPOTS - finds.length).fill(0)];
    for (const picks of choices) {
      const paid = sum(picks.map((cell) => board[cell]));
      split[paid === 0 ? 0 : paid < t.price ? 1 : paid === t.price ? 2 : 3] += slots;
    }
  }
  return split;
};

// paying the price back or more, as [numerator, denominator]; a treasure find under the price is still a loss
export const winOdds = (t: Ticket): [number, number] => {
  if (t.kind === "line") return [sum(t.prizes.map(([, m, slots]) => (m >= 1 ? slots : 0))), SLOTS];
  if (t.kind === "lucky") return [sum(t.outcomes.map((row) => (ninePays(row) >= 1 ? row[0] : 0))), SLOTS];
  const [, , back, more] = payoutSplit(t);
  return [back + more, choose(SPOTS, t.picks) * SLOTS];
};

export const topPrize = (t: Ticket) => {
  if (t.kind === "line") return t.price * Math.max(...t.prizes.map(([, m]) => m));
  if (t.kind === "lucky") return t.price * Math.max(...t.outcomes.map(ninePays));
  return Math.max(...t.boards.map(([, finds]) => sum([...finds].sort((a, b) => b - a).slice(0, t.picks))));
};

// the n in "1 in n": one decimal while it is small, whole and grouped once it is not
export const oneIn = (numerator: number, denominator = SLOTS) => {
  const n = denominator / numerator;
  return n < 10 ? n.toLocaleString("en-US", { maximumFractionDigits: 1 }) : Math.round(n).toLocaleString("en-US");
};

export const findSymbol = (t: PickTicket, amount: number) => t.finds.find(([, value]) => value === amount)?.[0] || null;

// the same text Monetary renders, for the labels the hook hands over as finished strings
export const kpText = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "DOL", maximumFractionDigits: 0 }).format(n).replace("DOL", "K₽");

export const symbolSrc = (name: string) => `/images/scratch/symbols/${name}.png`;

// every symbol any ticket can show
export const SYMBOLS = [
  ...new Set(TICKETS.flatMap((t) => (t.kind === "line" ? t.prizes.map(([symbol]) => symbol) : t.kind === "lucky" ? t.pool : t.finds.map(([symbol]) => symbol)))),
];
