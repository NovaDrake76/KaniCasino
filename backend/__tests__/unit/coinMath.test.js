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

  // the guarantee the original bug broke: the round's commitment is sha256(seed), so the
  // result must NOT be readable off it. deriving it that way must be no better than a toss.
  test("result cannot be predicted from the published commitment", () => {
    const N = 40000;
    // the OLD, broken derivation applied to the broadcast commitment
    const fromCommitment = (hash) => parseInt(hash.slice(0, 8), 16) % 2;
    let matches = 0;
    for (let i = 0; i < N; i++) {
      const seed = sha256(`predict:${i}`);
      if (fromCommitment(sha256(seed)) === coinResultFromSeed(seed)) matches += 1;
    }
    // chance is 50%; a broken scheme scored N/N here
    expect(matches / N).toBeGreaterThan(0.47);
    expect(matches / N).toBeLessThan(0.53);
  });
});
