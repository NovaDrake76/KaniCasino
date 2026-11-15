import { describe, it, expect } from "vitest";
import {
  COMMIT_SHARE,
  SPOT_BRUSH,
  SPOT_CLEAR,
  TICKET_CLEAR,
  WEAR,
  ZONE_BRUSH,
  clearedFraction,
  createSurface,
  isCommitted,
  isComplete,
  resetSurface,
  rub,
  stamp,
  strokePoints,
  type Point,
  type Surface,
} from "./scratchSurface";

// one pass the way a hand covers a coating: a row at a time, each row a fresh press, rows a brush and a half apart
const pass = (surface: Surface, r: number) => {
  const rowGap = (1.5 * r) / surface.aspect;
  for (let y = rowGap / 2; y < 1; y += rowGap) rub(surface, { x: 0.03, y }, { x: 0.97, y }, r);
};

describe("the coating's resistance", () => {
  it("starts fully covered", () => {
    const s = createSurface();
    expect(clearedFraction(s)).toBe(0);
    expect(isComplete(s)).toBe(false);
  });

  it("clears nothing on a press that does not move, however long it is held", () => {
    const s = createSurface();
    for (let k = 0; k < 50; k++) expect(rub(s, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, ZONE_BRUSH)).toEqual([]);
    expect(s.wear.every((w) => w === 0)).toBe(true);
    expect(clearedFraction(s)).toBe(0);
  });

  it("ignores a jitter shorter than one step between stamps", () => {
    const s = createSurface();
    expect(strokePoints({ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.5 }, ZONE_BRUSH)).toEqual([]);
    expect(rub(s, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.52 }, ZONE_BRUSH)).toEqual([]);
    expect(s.wear.every((w) => w === 0)).toBe(true);
  });

  it("spaces stamps by distance, so the same stroke wears the same however the pointer is sampled", () => {
    const worn = (s: Surface) => s.wear.reduce((a, w) => a + w, 0);
    const sampled = (step: number) => {
      const s = createSurface();
      let at = { x: 0.1, y: 0.5 };
      for (let x = 0.1 + step; x <= 0.9001; x += step) {
        const points = rub(s, at, { x, y: 0.5 }, ZONE_BRUSH);
        if (points.length) at = points[points.length - 1];
      }
      return worn(s);
    };
    const once = createSurface();
    rub(once, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, ZONE_BRUSH);
    for (const step of [0.001, 0.02, 0.045, 0.08]) expect(Math.abs(sampled(step) - worn(once)) / worn(once)).toBeLessThan(0.05);
    const points = strokePoints({ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, ZONE_BRUSH);
    expect(points[1].x - points[0].x).toBeCloseTo(ZONE_BRUSH * 0.4, 10);
  });

  it("wears a cell through only after seven stamps", () => {
    const s = createSurface();
    for (let k = 0; k < 6; k++) stamp(s, 0.5, 0.5, ZONE_BRUSH);
    expect(s.cleared).toBe(0);
    expect(Math.max(...s.wear)).toBeCloseTo(6 * WEAR, 5);
    stamp(s, 0.5, 0.5, ZONE_BRUSH);
    expect(s.cleared).toBeGreaterThan(0);
  });

  it("only thins the foil in one pass, and two passes clear the ticket", () => {
    const s = createSurface({ threshold: TICKET_CLEAR });
    pass(s, ZONE_BRUSH);
    expect(clearedFraction(s)).toBeLessThan(0.1);
    expect(isComplete(s)).toBe(false);
    pass(s, ZONE_BRUSH);
    expect(clearedFraction(s)).toBeGreaterThanOrEqual(TICKET_CLEAR);
    expect(isComplete(s)).toBe(true);
  });

  it("keeps the brush round on a coating that is wider than it is tall", () => {
    const s = createSurface({ aspect: 0.8 });
    expect(s.rows).toBe(16);
    pass(s, ZONE_BRUSH);
    expect(isComplete(s)).toBe(false);
    pass(s, ZONE_BRUSH);
    expect(isComplete(s)).toBe(true);
  });

  it("completes one treasure spot on its own lower bar, two passes of the spot brush", () => {
    expect(SPOT_CLEAR).toBeLessThan(TICKET_CLEAR);
    const spot = createSurface({ threshold: SPOT_CLEAR });
    pass(spot, SPOT_BRUSH);
    expect(isComplete(spot)).toBe(false);
    pass(spot, SPOT_BRUSH);
    expect(isComplete(spot)).toBe(true);
    // another spot is its own surface and is untouched by the first
    const other = createSurface({ threshold: SPOT_CLEAR });
    expect(clearedFraction(other)).toBe(0);
  });
});

// one press played the way the coating plays it: the anchor carries from one pointer move to the next
const press = (surface: Surface, path: Point[]) => {
  let at = path[0];
  for (const p of path.slice(1)) {
    const points = rub(surface, at, p, SPOT_BRUSH);
    if (points.length) at = points[points.length - 1];
  }
  return surface;
};
const line = (from: Point, to: Point, moves = 20): Point[] =>
  Array.from({ length: moves + 1 }, (_, k) => ({ x: from.x + ((to.x - from.x) * k) / moves, y: from.y + ((to.y - from.y) * k) / moves }));
// a hand rubbing back and forth across the spot, `strokes` one-way strokes of `reach` either side of the middle, sampled
// every 16 ms at six strokes a second
const rubbing = (strokes: number, reach = 0.3) => {
  const path: Point[] = [];
  const perStroke = Math.round(1000 / 6 / 16);
  for (let k = 0; k <= strokes * perStroke; k++) path.push({ x: 0.5 - reach * Math.cos((Math.PI * k) / perStroke), y: 0.5 + 0.04 * Math.sin(k / 3) });
  return path;
};

describe("a treasure spot's commit point", () => {
  const spot = () => createSurface({ threshold: SPOT_CLEAR });

  it("sits a quarter of the way to the spot's clear threshold", () => {
    expect(COMMIT_SHARE).toBe(0.25);
    const s = spot();
    expect(isCommitted(s)).toBe(false);
    s.cleared = Math.ceil(s.cols * s.rows * SPOT_CLEAR * COMMIT_SHARE);
    expect(isCommitted(s)).toBe(true);
    expect(isComplete(s)).toBe(false);
  });

  it("is never reached by a tap or a short flick", () => {
    expect(isCommitted(press(spot(), [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }]))).toBe(false);
    for (const [dx, dy] of [[0.3, 0], [0, 0.3], [0.2, 0.2], [-0.25, 0.1]]) {
      expect(isCommitted(press(spot(), line({ x: 0.5, y: 0.5 }, { x: 0.5 + dx, y: 0.5 + dy })))).toBe(false);
    }
  });

  it("is never reached by one straight swipe, at any angle or offset, however far past the spot it runs", () => {
    for (let deg = 0; deg < 180; deg += 5) {
      const a = (deg * Math.PI) / 180;
      const [dx, dy] = [Math.cos(a), Math.sin(a)];
      for (let off = -0.5; off <= 0.5; off += 0.05) {
        const [cx, cy] = [0.5 - dy * off, 0.5 + dx * off];
        const s = press(spot(), line({ x: cx - 1.5 * dx, y: cy - 1.5 * dy }, { x: cx + 1.5 * dx, y: cy + 1.5 * dy }, 60));
        expect(clearedFraction(s)).toBe(0);
      }
    }
  });

  it("is reached by about half a second of rubbing back and forth, well before the spot clears", () => {
    expect(isCommitted(press(spot(), rubbing(1)))).toBe(false);
    const s = press(spot(), rubbing(3));
    expect(isCommitted(s)).toBe(true);
    expect(isComplete(s)).toBe(false);
  });

  it("forgets every stamp of a press on reset", () => {
    const s = press(spot(), rubbing(2));
    expect(clearedFraction(s)).toBeGreaterThan(0);
    resetSurface(s);
    expect(clearedFraction(s)).toBe(0);
    expect(s.wear.every((w) => w === 0)).toBe(true);
    expect(isCommitted(press(s, rubbing(1)))).toBe(false);
  });
});
