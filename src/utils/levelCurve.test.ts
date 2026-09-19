import { describe, it, expect } from "vitest";
import { levelProgress, xpForLevel, xpBonusPct } from "./levelCurve";

describe("the level curve", () => {
  it("reaches each level at the total the server levels on", () => {
    expect([0, 1, 5, 10, 30, 100].map(xpForLevel)).toEqual([0, 200, 12499, 45000, 4000000, 15000000000]);
  });

  it("keeps climbing past the last anchor", () => {
    expect(xpForLevel(120)).toBeGreaterThan(xpForLevel(100) * 4);
  });

  it("measures progress from the last level-up to the next one", () => {
    expect(levelProgress(xpForLevel(6), 6)).toBe(0);
    expect(levelProgress((xpForLevel(6) + xpForLevel(7)) / 2, 6)).toBeCloseTo(0.5);
    expect(levelProgress(100, 0)).toBe(0.5);
  });

  it("stays inside the bar when xp and level disagree", () => {
    expect(levelProgress(0, 6)).toBe(0);
    expect(xpForLevel(2) < 9999 ? levelProgress(9999, 2) : 1).toBe(1);
  });

  it("reads the shop's boost as a percent", () => {
    expect(xpBonusPct(undefined)).toBe(0);
    expect(xpBonusPct({ all: 1.35 })).toBe(35);
  });
});
