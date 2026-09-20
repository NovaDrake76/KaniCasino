const { ANCHORS, kpForLevel, xpForLevel, levelFromXp, oldXpForLevel, xpGain, xpMultiplier, XP_PER_KP } = require("../../utils/xpCurve");
const { carriedXp } = require("../../scripts/migrateXpCurve");

describe("the level ladder", () => {
  test("passes through every anchor, in K₽ wagered", () => {
    for (const [level, kp] of ANCHORS) expect(kpForLevel(level)).toBeCloseTo(kp, 0);
  });

  test("a level is its anchor's K₽ times the xp per K₽, and level 0 needs nothing", () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(10)).toBe(9000 * XP_PER_KP);
    expect(xpForLevel(100)).toBe(3000000000 * XP_PER_KP);
  });

  test("keeps climbing past the last anchor", () => {
    expect(xpForLevel(120)).toBeGreaterThan(xpForLevel(100) * 4);
    expect(xpForLevel(200)).toBeGreaterThan(xpForLevel(120));
  });

  test("level is non-decreasing in xp, and each threshold lands on its level", () => {
    let prev = 0;
    for (let xp = 0; xp <= 500000; xp += 977) {
      const level = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
    for (const level of [1, 5, 10, 30, 75, 100]) {
      expect(levelFromXp(xpForLevel(level))).toBe(level);
      expect(levelFromXp(xpForLevel(level) - 1)).toBe(level - 1);
    }
  });

  test("the start is slower than the old ladder and the end much faster", () => {
    expect(xpForLevel(10)).toBeGreaterThan(oldXpForLevel(10));
    expect(xpForLevel(100)).toBeLessThan(oldXpForLevel(100));
  });
});

describe("boosted xp", () => {
  test("a bet earns five xp per K₽, times the boosts held, plus the charm of its game", () => {
    expect(xpGain(100, "dice", undefined)).toBe(500);
    expect(xpGain(100, "dice", { all: 1.35 })).toBe(675);
    expect(xpGain(100, "dice", { all: 1.35, dice: 0.25 })).toBe(800);
    expect(xpGain(100, "crash", { all: 1.35, dice: 0.25 })).toBe(675);
    expect(xpMultiplier({}, null)).toBe(1);
  });
});

describe("carrying an account onto the new ladder", () => {
  test("keeps the level and how far into it the account was", () => {
    for (const level of [0, 1, 5, 10, 30, 50, 70]) {
      const lo = oldXpForLevel(level);
      const hi = oldXpForLevel(level + 1);
      const xp = carriedXp(level, lo + (hi - lo) * 0.4);
      expect(levelFromXp(xp)).toBe(level);
      const span = xpForLevel(level + 1) - xpForLevel(level);
      expect((xp - xpForLevel(level)) / span).toBeCloseTo(0.4, 1);
    }
  });

  test("trusts the stored level when it is above what the xp says, and the xp when a bet lowered the level first", () => {
    // an admin-set level with little xp keeps its level
    expect(levelFromXp(carriedXp(122, 122340))).toBe(122);
    // a bet that slipped in and recomputed the level down: the old xp still says 30
    expect(levelFromXp(carriedXp(16, oldXpForLevel(30) + 10))).toBe(30);
  });
});
