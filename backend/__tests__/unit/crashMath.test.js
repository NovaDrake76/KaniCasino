const { multiplierAt, crashPointFromRandom } = require("../../utils/crashMath");

describe("crash math", () => {
  test("crash point is at least 1.0", () => {
    expect(crashPointFromRandom(0)).toBe(1);
    for (let i = 0; i < 1000; i++) {
      const h = Math.floor((i / 1000) * 2 ** 32);
      expect(crashPointFromRandom(h)).toBeGreaterThanOrEqual(1);
    }
  });

  test("multiplier starts at 1 and grows then caps at the crash point", () => {
    expect(multiplierAt(0, 5)).toBeCloseTo(1, 6);
    expect(multiplierAt(1000, 5)).toBe(5); // capped
    expect(multiplierAt(5, 5)).toBeLessThanOrEqual(5);
  });

  test("multiplier is non-decreasing in elapsed time (below the cap)", () => {
    let prev = 0;
    for (let t = 0; t < 30; t += 0.5) {
      const m = multiplierAt(t, 1000);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
});
