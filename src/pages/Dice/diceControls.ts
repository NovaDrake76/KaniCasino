// client mirror of backend/utils/diceMath.js: the same 10000-outcome space and 99% RTP
// multiplier, so what the panel shows is exactly what the server will settle.
export type Direction = "over" | "under";

export const OUTCOMES = 10000;
export const MIN_WIN_COUNT = 200; // 2% win chance
export const MAX_WIN_COUNT = 9800; // 98% win chance
export const MIN_BET = 1;
export const MAX_BET = 20000;

// target is stored in 0.01 units (50.50 -> 5050); this is the value the slider carries
export const winCountFor = (target: number, direction: Direction) =>
    direction === "under" ? target : OUTCOMES - target;

export const targetForWinCount = (winCount: number, direction: Direction) =>
    direction === "under" ? winCount : OUTCOMES - winCount;

export const winChanceFor = (winCount: number) => (winCount / OUTCOMES) * 100;

// 4-decimal multiplier, matching the server's fixed-point rounding to the cent
export const multiplierFor = (winCount: number) =>
    Math.round((99 * OUTCOMES * 10000) / 100 / winCount) / 10000;

export const clampTarget = (target: number, direction: Direction) => {
    const min = targetForWinCount(direction === "under" ? MIN_WIN_COUNT : MAX_WIN_COUNT, direction);
    const max = targetForWinCount(direction === "under" ? MAX_WIN_COUNT : MIN_WIN_COUNT, direction);
    return Math.min(Math.max(Math.round(target), Math.min(min, max)), Math.max(min, max));
};

// derive a target (0.01 units) from a desired win chance percent, clamped to the band
export const targetForWinChance = (chancePercent: number, direction: Direction) => {
    const winCount = Math.round((chancePercent / 100) * OUTCOMES);
    const bounded = Math.min(Math.max(winCount, MIN_WIN_COUNT), MAX_WIN_COUNT);
    return targetForWinCount(bounded, direction);
};

// derive a target from a desired multiplier (inverse of multiplierFor), clamped
export const targetForMultiplier = (multiplier: number, direction: Direction) => {
    const winCount = Math.round((99 * OUTCOMES) / 100 / multiplier);
    const bounded = Math.min(Math.max(winCount, MIN_WIN_COUNT), MAX_WIN_COUNT);
    return targetForWinCount(bounded, direction);
};

export interface DiceControlState {
    target: number; // 0.01 units
    direction: Direction;
    winCount: number;
    winChance: number; // percent
    multiplier: number;
    payoutOnWin: (bet: number) => number;
}

export const controlsFor = (target: number, direction: Direction): DiceControlState => {
    const winCount = winCountFor(target, direction);
    const multiplier = multiplierFor(winCount);
    return {
        target,
        direction,
        winCount,
        winChance: winChanceFor(winCount),
        multiplier,
        payoutOnWin: (bet) => Math.floor(bet * multiplier * 100) / 100,
    };
};
