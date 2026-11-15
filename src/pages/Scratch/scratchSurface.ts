// the coating's wear as a coarse grid, so a stroke never reads pixels back off the canvas. the foil resists: only a moving
// stroke stamps, each stamp wears the cells under it, and a cell clears once worn through, so one pass thins and two clear
export const COLS = 20;
// what one stamp wears off a cell; a cell is cleared at 1, which takes seven stamps
export const WEAR = 0.16;
// what one stamp takes off the painted foil, so the picture thins at the same pace the grid wears
export const STAMP_ALPHA = 0.3;
// stamps sit this fraction of the brush radius apart along a stroke, so speed never changes how much a stroke clears
export const SPACING = 0.4;
// how much of the coating has to be cleared before the ticket shows, and before one treasure spot does
export const TICKET_CLEAR = 0.62;
export const SPOT_CLEAR = 0.55;
// the brush radius as a fraction of the coating's width: the big zones, and one treasure spot
export const ZONE_BRUSH = 0.075;
export const SPOT_BRUSH = 0.16;

export type Point = { x: number; y: number };

export interface Surface {
  cols: number;
  rows: number;
  // height over width, so a brush stays round on a coating that is not square
  aspect: number;
  wear: Float32Array;
  cleared: number;
  threshold: number;
}

export const createSurface = ({ aspect = 1, threshold = TICKET_CLEAR, cols = COLS } = {}): Surface => {
  const rows = Math.max(1, Math.round(cols * aspect));
  return { cols, rows, aspect, wear: new Float32Array(cols * rows), cleared: 0, threshold };
};

// wears every cell whose centre is inside the brush; x and y are fractions of the width and height, r of the width
export const stamp = (surface: Surface, x: number, y: number, r: number) => {
  const { cols, rows, aspect, wear } = surface;
  const ry = r / aspect;
  const i0 = Math.max(0, Math.floor((x - r) * cols));
  const i1 = Math.min(cols - 1, Math.floor((x + r) * cols));
  const j0 = Math.max(0, Math.floor((y - ry) * rows));
  const j1 = Math.min(rows - 1, Math.floor((y + ry) * rows));
  for (let j = j0; j <= j1; j++) {
    const dy = ((j + 0.5) / rows - y) * aspect;
    for (let i = i0; i <= i1; i++) {
      const dx = (i + 0.5) / cols - x;
      const k = j * cols + i;
      if (wear[k] >= 1 || dx * dx + dy * dy > r * r) continue;
      wear[k] += WEAR;
      if (wear[k] >= 1) surface.cleared += 1;
    }
  }
};

// stamps exactly one step apart from the last one, which is the next anchor: a press that does not move clears nothing,
// and a stroke wears the same however the browser samples the pointer
export const strokePoints = (from: Point, to: Point, r: number, aspect = 1): Point[] => {
  const gap = r * SPACING;
  const length = Math.hypot(to.x - from.x, (to.y - from.y) * aspect);
  const steps = Math.floor(length / gap);
  return Array.from({ length: steps }, (_, k) => {
    const t = ((k + 1) * gap) / length;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
};

// one pointer move: the points it stamped, which the canvas paints; the last one is the caller's next anchor
export const rub = (surface: Surface, from: Point, to: Point, r: number): Point[] => {
  const points = strokePoints(from, to, r, surface.aspect);
  for (const p of points) stamp(surface, p.x, p.y, r);
  return points;
};

export const clearedFraction = (surface: Surface) => surface.cleared / (surface.cols * surface.rows);
export const isComplete = (surface: Surface) => clearedFraction(surface) >= surface.threshold;

// a treasure spot is only spent once one press has cleared this share of its threshold. stamps sit 0.4 of a radius apart, so
// one straight stroke reaches a cell six times at most and a cell clears at seven: a tap, a flick or a swipe never commits
export const COMMIT_SHARE = 0.25;
export const isCommitted = (surface: Surface) => clearedFraction(surface) >= surface.threshold * COMMIT_SHARE;

// back to whole foil, for a press that lifted before its commit point
export const resetSurface = (surface: Surface) => {
  surface.wear.fill(0);
  surface.cleared = 0;
};
