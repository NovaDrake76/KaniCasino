// client mirror of backend/utils/minesMath.js for the multiplier readouts; the server
// is authoritative for outcomes, this only drives what the panel shows.
export const TILES = 25;
export const COLS = 5;
export const MIN_MINES = 1;
export const MAX_MINES = 24;
export const MIN_BET = 1;
export const MAX_BET = 10000;
export const MAX_PAYOUT = 1_000_000;
const RTP = 0.99;

export const mineOptions = Array.from({ length: MAX_MINES }, (_, i) => i + 1);

export const gemsFor = (mineCount: number) => TILES - mineCount;

export const multiplierFor = (mineCount: number, gems: number) => {
    if (gems <= 0) return 1;
    let m = 1;
    for (let i = 0; i < gems; i++) m *= (TILES - i) / (TILES - mineCount - i);
    return RTP * m;
};

export const payoutFor = (betAmount: number, mineCount: number, gems: number) =>
    Math.min(Math.round(betAmount * multiplierFor(mineCount, gems) * 100) / 100, MAX_PAYOUT);
