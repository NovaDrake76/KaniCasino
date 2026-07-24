const {
  OUTCOMES,
  resultFromFloat,
  winCountFor,
  isWin,
  multiplierFor,
  winChanceFor,
  payoutCentsFor,
  normalizeTarget,
  validBet,
  resolveRoll,
} = require("../../utils/diceMath");

describe("dice math", () => {
  test("result maps a float to 0..9999", () => {
    expect(resultFromFloat(0)).toBe(0);
    expect(resultFromFloat(0.99999)).toBe(9999);
    expect(resultFromFloat(0.5)).toBe(5000);
  });

  test("under and over win conditions are exactly complementary", () => {
    const target = 5050;
    for (const result of [0, 5049, 5050, 9999]) {
      expect(isWin(result, target, "under")).toBe(result < target);
      expect(isWin(result, target, "over")).toBe(result >= target);
      // every outcome wins exactly one side
      expect(isWin(result, target, "under")).not.toBe(isWin(result, target, "over"));
    }
    expect(winCountFor(target, "under") + winCountFor(target, "over")).toBe(OUTCOMES);
  });

  test("multiplier and win chance reproduce the Stake table (99% RTP)", () => {
    const cases = [
      { winCount: 4950, chance: 49.5, mult: 2 },
      { winCount: 200, chance: 2, mult: 49.5 },
      { winCount: 2000, chance: 20, mult: 4.95 },
      { winCount: 6500, chance: 65, mult: 1.5231 },
      { winCount: 8000, chance: 80, mult: 1.2375 },
      { winCount: 9800, chance: 98, mult: 1.0102 },
    ];
    for (const c of cases) {
      expect(winChanceFor(c.winCount)).toBeCloseTo(c.chance, 6);
      expect(multiplierFor(c.winCount)).toBeCloseTo(c.mult, 4);
      // the realized RTP is 99% at every win chance
      expect((c.winCount / OUTCOMES) * multiplierFor(c.winCount)).toBeCloseTo(0.99, 3);
    }
  });

  test("payout is exact integer cents, zero on a loss", () => {
    expect(payoutCentsFor(100, 4950, true)).toBe(20000); // 100 * 2.0000
    expect(payoutCentsFor(100, 4950, false)).toBe(0);
    expect(payoutCentsFor(200, 200, true)).toBe(990000); // 200 * 49.50 = 9900.00
  });

  test("targets outside the 2%..98% band are refused", () => {
    expect(normalizeTarget(5050, "under")).toBe(5050);
    expect(normalizeTarget(5050, "over")).toBe(5050);
    expect(normalizeTarget(200, "under")).toBe(200); // exactly 2% win chance
    expect(normalizeTarget(9800, "under")).toBe(9800); // exactly 98%
    expect(normalizeTarget(199, "under")).toBe(null); // under 2%
    expect(normalizeTarget(9801, "under")).toBe(null); // over 98%
    expect(normalizeTarget(9801, "over")).toBe(null); // winCount 199, under 2%
    expect(normalizeTarget(0, "under")).toBe(null);
    expect(normalizeTarget(10000, "under")).toBe(null);
    expect(normalizeTarget(50.5, "under")).toBe(null); // not an integer 0.01 unit
    expect(normalizeTarget(5000, "sideways")).toBe(null);
  });

  test("bet bounds are whole coins 1..20000", () => {
    expect(validBet(1)).toBe(true);
    expect(validBet(20000)).toBe(true);
    expect(validBet(0)).toBe(false);
    expect(validBet(20001)).toBe(false);
    expect(validBet(10.5)).toBe(false);
    expect(validBet("100")).toBe(false);
  });

  test("resolveRoll ties result, win, and payout together", () => {
    // float 0.75 -> result 7500; over 5050 wins (7500 >= 5050)
    const win = resolveRoll(0.75, 100, 5050, "over");
    expect(win.result).toBe(7500);
    expect(win.resultValue).toBe(75);
    expect(win.won).toBe(true);
    expect(win.multiplier).toBe(2);
    expect(win.payout).toBe(200);

    // same roll, under 5050 loses (7500 is not < 5050)
    const loss = resolveRoll(0.75, 100, 5050, "under");
    expect(loss.won).toBe(false);
    expect(loss.payout).toBe(0);
  });
});
