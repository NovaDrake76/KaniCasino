import { describe, expect, test } from "vitest";
import {
  BINS,
  MAX_BET,
  MAX_WIN,
  PAYOUT_MULTIPLIERS,
  RISKS,
  ROWS,
  ballKeyframes,
  binCenterX,
  binColor,
  pegRows,
} from "./plinkoBoard";

describe("plinko payout display tables", () => {
  test("every risk has one multiplier per bin, mirrored around the center", () => {
    for (const risk of RISKS) {
      const table = PAYOUT_MULTIPLIERS[risk];
      expect(table).toHaveLength(BINS);
      for (let k = 0; k < BINS; k++) {
        expect(table[k]).toBe(table[ROWS - k]);
        expect(table[k]).toBeGreaterThan(0);
      }
    }
  });

  test("the bet cap of each risk keeps its top payout at the max win", () => {
    for (const risk of RISKS) {
      expect(MAX_BET[risk] * PAYOUT_MULTIPLIERS[risk][0]).toBeLessThanOrEqual(MAX_WIN);
    }
  });
});

describe("plinko board geometry", () => {
  test("the peg triangle grows one peg per row", () => {
    const rows = pegRows();
    expect(rows).toHaveLength(ROWS);
    rows.forEach((row, i) => expect(row).toHaveLength(i + 3));
  });

  test("ball keyframes follow the path and end at the landing bin", () => {
    const path = "RLRRLLRLRLRRLLRL";
    const { xs, ys, times, bin } = ballKeyframes(path);
    expect(bin).toBe(path.split("R").length - 1);
    expect(xs).toHaveLength(2 + ROWS * 2);
    expect(ys).toHaveLength(xs.length);
    expect(times).toHaveLength(xs.length);
    expect(times[0]).toBe(0);
    expect(times[times.length - 1]).toBeCloseTo(1, 10);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
    expect(xs[xs.length - 1]).toBe(binCenterX(bin));
  });

  test("edge paths land in the outermost bins", () => {
    expect(ballKeyframes("L".repeat(ROWS)).bin).toBe(0);
    expect(ballKeyframes("R".repeat(ROWS)).bin).toBe(ROWS);
  });

  test("every bin has a color", () => {
    for (let k = 0; k < BINS; k++) {
      expect(binColor(k)).toMatch(/^#/);
    }
  });
});
