const { calculateLevelFromXp, calculateXPForLevel } = require("../../utils/economy");

describe("level calculation", () => {
  test("level is 0 below the first threshold", () => {
    expect(calculateLevelFromXp(0)).toBe(0);
    expect(calculateLevelFromXp(999)).toBe(0);
  });

  test("known boundaries", () => {
    expect(calculateLevelFromXp(calculateXPForLevel(1))).toBe(1); // 1000
    expect(calculateLevelFromXp(calculateXPForLevel(1) - 1)).toBe(0);
    expect(calculateLevelFromXp(calculateXPForLevel(2))).toBe(2);
  });

  test("level is non-decreasing in xp", () => {
    let prev = 0;
    for (let xp = 0; xp <= 200000; xp += 137) {
      const lvl = calculateLevelFromXp(xp);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });
});
