// the reel symbols, best first: their art, their share of the reel and what three in a line pays times the bet.
// mirrors backend/games/slot.js (symbolFrequencies and symbolPayouts), and slot.test.js pins the payouts
export const SLOT_SYMBOLS = [
  { key: "wild", image: "/images/slot/wild.webp", weight: 20, pays: 100 },
  { key: "yellow", image: "/images/slot/green.webp", weight: 20, pays: 25 },
  { key: "hakkero", image: "/images/slot/hakkero.webp", weight: 30, pays: 12 },
  { key: "yin_yang", image: "/images/slot/yin.webp", weight: 50, pays: 8 },
  { key: "green", image: "/images/slot/lily.webp", weight: 80, pays: 3 },
  { key: "blue", image: "/images/slot/shangai.webp", weight: 90, pays: 1 },
  { key: "red", image: "/images/slot/red.webp", weight: 100, pays: 0.5 },
] as const;

export const symbolImage = (key: string) => SLOT_SYMBOLS.find((symbol) => symbol.key === key)?.image;

const POOL = SLOT_SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
const WILD = SLOT_SYMBOLS[0].weight;

// the chance one line pays a symbol: three of it, wilds standing in, but not three wilds, which pay their own
export const lineChance = (key: string) => {
  const symbol = SLOT_SYMBOLS.find((s) => s.key === key);
  if (!symbol) return 0;
  if (symbol.key === "wild") return (WILD / POOL) ** 3;
  return ((symbol.weight + WILD) ** 3 - WILD ** 3) / POOL ** 3;
};
