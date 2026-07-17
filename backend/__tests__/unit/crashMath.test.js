const { multiplierAt, crashPointFromRandom, crashPointFromSeed, INSTANT_CRASH_CHANCE } = require("../../utils/crashMath");
const { sha256 } = require("../../utils/hashChain");

// the OLD, broken derivation: read the outcome straight off sha256(seed). since sha256(seed)
// is exactly the commitment broadcast at betting open, anything derivable this way was public.
const crashFromCommitment = (hash) => {
  const bust = parseInt(hash.slice(0, 8), 16) / 2 ** 32;
  if (bust < INSTANT_CRASH_CHANCE) return 1.0;
  return crashPointFromRandom(parseInt(hash.slice(8, 16), 16));
};

describe("crash math", () => {
  test("crash point is at least 1.0", () => {
    expect(crashPointFromRandom(0)).toBe(1);
    for (let i = 0; i < 1000; i++) {
      const h = Math.floor((i / 1000) * 2 ** 32);
      expect(crashPointFromRandom(h)).toBeGreaterThanOrEqual(1);
    }
  });

  test("crash point is deterministic, with a stable small bust-to-1.0 rate", () => {
    const seed = sha256("determinism");
    expect(crashPointFromSeed(seed)).toBe(crashPointFromSeed(seed));
    const N = 40000;
    let atOne = 0;
    for (let i = 0; i < N; i++) {
      if (crashPointFromSeed(sha256(`crash:${i}`)) === 1.0) atOne += 1;
    }
    // the 3% instant bust plus the curve's lowest bucket that also rounds to 1.00
    expect(atOne / N).toBeGreaterThan(0.03);
    expect(atOne / N).toBeLessThan(0.055);
  });

  // the guarantee the original bug broke: the outcome must NOT be derivable from the
  // published commitment sha256(seed). deriving it that way must be no better than luck.
  test("crash point cannot be predicted from the published commitment", () => {
    const N = 5000;
    let matches = 0;
    for (let i = 0; i < N; i++) {
      const seed = sha256(`predict:${i}`);
      if (crashFromCommitment(sha256(seed)) === crashPointFromSeed(seed)) matches += 1;
    }
    // exact-value coincidences only; the broken scheme scored N/N here
    expect(matches / N).toBeLessThan(0.05);
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
