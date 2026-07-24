// client mirror of backend/utils/hiloMath.js for the odds readouts; the server is
// authoritative for the cards and payouts. card 0..51, rank = card % 13 (0 = ace, the
// lowest, 12 = king, the highest).
export const RANKS = 13;
export const MIN_BET = 1;
export const MAX_BET = 10000;
export const MAX_SKIPS = 52;

export const rankOf = (card: number) => card % RANKS;
export const hiChance = (rank: number) => (RANKS - rank) / RANKS;
export const loChance = (rank: number) => (rank + 1) / RANKS;

export const pct = (chance: number) => `${(chance * 100).toFixed(2)}%`;
