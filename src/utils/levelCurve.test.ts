import { describe, it, expect } from "vitest";
import { levelProgress, xpForLevel } from "./levelCurve";

describe("the level curve", () => {
  it("reaches each level at the total the server levels on", () => {
    expect([0, 1, 2, 3, 5, 6, 7].map(xpForLevel)).toEqual([0, 1000, 1250, 1562, 2441, 3051, 3814]);
  });

  it("measures progress from the last level-up to the next one", () => {
    expect(levelProgress(3051, 6)).toBe(0);
    expect(levelProgress(3432.5, 6)).toBeCloseTo(0.5);
    expect(levelProgress(500, 0)).toBe(0.5);
  });

  it("stays inside the bar when xp and level disagree", () => {
    expect(levelProgress(0, 6)).toBe(0);
    expect(levelProgress(9999, 2)).toBe(1);
  });
});
