import { describe, expect, test } from "vitest";
import { compactKp, dayString, fillDays, shortDay } from "./adminSeries";

const point = (day: string, ggr = 0) => ({ day, wagered: 0, paidOut: 0, ggr, faucet: 0, players: 0 });
const daysAgo = (n: number) => dayString(new Date(Date.now() - n * 24 * 60 * 60 * 1000));

describe("fillDays", () => {
  test("fills the gaps between active days with zero rows", () => {
    const filled = fillDays([point(daysAgo(3), 50), point(daysAgo(0), 20)], 7);
    expect(filled).toHaveLength(4);
    expect(filled[0].ggr).toBe(50);
    expect(filled[1].ggr).toBe(0);
    expect(filled[2].ggr).toBe(0);
    expect(filled[3].ggr).toBe(20);
  });

  test("never reaches past the window even when older rows exist", () => {
    const filled = fillDays([point(daysAgo(30), 99), point(daysAgo(1), 5)], 7);
    expect(filled.length).toBeLessThanOrEqual(7);
    expect(filled.some((p) => p.ggr === 99)).toBe(false);
  });

  test("an empty series still yields a full window of zero days", () => {
    const filled = fillDays([], 7);
    expect(filled).toHaveLength(7);
    expect(filled.every((p) => p.ggr === 0)).toBe(true);
    expect(filled[6].day).toBe(daysAgo(0));
  });
});

describe("formatting", () => {
  test("compactKp abbreviates thousands and millions and keeps signs", () => {
    expect(compactKp(950)).toBe("950");
    expect(compactKp(1500)).toBe("1.5k");
    expect(compactKp(25000)).toBe("25k");
    expect(compactKp(4116480)).toBe("4.1M");
    expect(compactKp(-1500)).toBe("-1.5k");
  });

  test("shortDay renders a day-month label", () => {
    expect(shortDay("2026-07-19")).toBe("19/7");
  });
});
