const { coinResultFromSeed } = require("../../utils/coinMath");
const { sha256 } = require("../../utils/hashChain");

describe("coin result from seed", () => {
  test("is 0 or 1 and deterministic", () => {
    for (let i = 0; i < 1000; i++) {
      const seed = sha256(`s:${i}`);
      const r = coinResultFromSeed(seed);
      expect([0, 1]).toContain(r);
      expect(coinResultFromSeed(seed)).toBe(r);
    }
  });

  test("is a fair coin across many seeds", () => {
    // deterministic seeds so the measured rate is fixed, not a flaky random sample
    const N = 40000;
    let heads = 0;
    for (let i = 0; i < N; i++) {
      if (coinResultFromSeed(sha256(`coin:${i}`)) === 0) heads += 1;
    }
    // 50/50 within a wide margin
    expect(heads / N).toBeGreaterThan(0.48);
    expect(heads / N).toBeLessThan(0.52);
  });
});
