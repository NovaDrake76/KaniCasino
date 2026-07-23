// client mirror of the server curve: GROWTH must stay in sync with backend/utils/crashMath.js
export const GROWTH = 0.06;
// the x axis never shrinks below this window, so the early curve crawls instead of filling the frame
export const MIN_WINDOW_S = 8;
// headroom above the tip so the curve never touches the top of the plot
export const Y_HEADROOM = 1.18;

export const multiplierAt = (elapsedSeconds: number) => Math.exp(elapsedSeconds * GROWTH);
export const elapsedFor = (multiplier: number) => Math.log(Math.max(multiplier, 1)) / GROWTH;

export interface AxisRange {
    xMax: number;
    yMax: number;
}

export const axisRange = (elapsedSeconds: number, multiplier: number): AxisRange => ({
    xMax: Math.max(elapsedSeconds, MIN_WINDOW_S),
    yMax: Math.max(multiplier * Y_HEADROOM, 2),
});

// plot-space mapping; y is linear so the exponential shape reads as acceleration
export const pointFor = (t: number, m: number, range: AxisRange, w: number, h: number) => ({
    x: (t / range.xMax) * w,
    y: h - ((m - 1) / (range.yMax - 1)) * h,
});

// smallest step from the 1/2/5 ladder that keeps at most `target` labels on an axis
export const tickStep = (max: number, target = 5) => {
    const raw = max / target;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const mult of [1, 2, 5]) {
        if (raw <= mult * pow) return mult * pow;
    }
    return 10 * pow;
};

export const yTicks = (yMax: number): number[] => {
    const step = tickStep(yMax - 1, 4);
    const ticks = [];
    for (let v = 1; v <= yMax; v += step) ticks.push(Number(v.toFixed(2)));
    return ticks;
};

export const xTicks = (xMax: number): number[] => {
    const step = tickStep(xMax, 5);
    const ticks = [];
    for (let v = 0; v <= xMax; v += step) ticks.push(Number(v.toFixed(2)));
    return ticks;
};
