const {
  TILES,
  MAX_PAYOUT,
  validMineCount,
  validBet,
  deriveMines,
  multiplierFor,
  payoutCentsFor,
} = require("../../utils/minesMath");
const { sha256 } = require("../../utils/hashChain");

describe("mines math", () => {
  test("mine derivation is deterministic and yields the right count of distinct tiles", () => {
    const seed = sha256("mines-determinism");
    const a = deriveMines(seed, "client", 0, 5);
    const b = deriveMines(seed, "client", 0, 5);
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
    expect(new Set(a).size).toBe(5);
    expect(a.every((t) => t >= 0 && t < TILES)).toBe(true);
    // sorted ascending
    expect([...a].sort((x, y) => x - y)).toEqual(a);
  });

  test("mine counts stay within the grid across many seeds and counts", () => {
    for (let i = 0; i < 200; i++) {
      const seed = sha256(`mines:${i}`);
      const count = 1 + (i % 24);
      const mines = deriveMines(seed, "c", i, count);
      expect(mines).toHaveLength(count);
      expect(new Set(mines).size).toBe(count);
    }
  });

  test("multiplier follows the Stake formula (99% RTP) and rises with each gem", () => {
    expect(multiplierFor(3, 0)).toBe(1); // nothing revealed
    // 3 mines, 1 gem: 0.99 * 25/22
    expect(multiplierFor(3, 1)).toBeCloseTo(0.99 * (25 / 22), 8);
    // 1 mine, revealing all 24 safe tiles telescopes to 0.99 * 25
    expect(multiplierFor(1, 24)).toBeCloseTo(0.99 * 25, 6);
    let prev = 0;
    for (let g = 1; g <= 22; g++) {
      const m = multiplierFor(3, g);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });

  test("payout is capped at the max win", () => {
    // a mid config with many gems blows past the cap
    const big = payoutCentsFor(10000, 12, 13);
    expect(big).toBe(MAX_PAYOUT * 100);
    // a modest one is not capped
    const small = payoutCentsFor(100, 3, 1);
    expect(small).toBe(Math.round(100 * multiplierFor(3, 1) * 100));
  });

  test("validation bounds", () => {
    expect(validMineCount(1)).toBe(true);
    expect(validMineCount(24)).toBe(true);
    expect(validMineCount(0)).toBe(false);
    expect(validMineCount(25)).toBe(false);
    expect(validMineCount(3.5)).toBe(false);
    expect(validBet(1)).toBe(true);
    expect(validBet(10000)).toBe(true);
    expect(validBet(0)).toBe(false);
    expect(validBet(10001)).toBe(false);
    expect(validBet(5.5)).toBe(false);
  });
});
