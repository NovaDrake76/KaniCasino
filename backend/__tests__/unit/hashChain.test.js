const { sha256, generateChain, linksTo } = require("../../utils/hashChain");
const { crashPointFromSeed, INSTANT_CRASH_CHANCE } = require("../../utils/crashMath");

describe("hash chain", () => {
  test("each consumed seed links back to the commitment, in order", () => {
    const { seeds, terminalHash } = generateChain(50);

    // round 1's seed hashes to the terminal; every later seed hashes to the prior one
    expect(linksTo(seeds[0], terminalHash)).toBe(true);
    for (let i = 1; i < seeds.length; i++) {
      expect(linksTo(seeds[i], seeds[i - 1])).toBe(true);
      expect(sha256(seeds[i])).toBe(seeds[i - 1]);
    }
  });

  test("a tampered seed does not verify", () => {
    const { seeds } = generateChain(10);
    expect(linksTo(seeds[2] + "00", sha256(seeds[1]))).toBe(false);
  });

  test("two chains are independent", () => {
    expect(generateChain(5).terminalHash).not.toBe(generateChain(5).terminalHash);
  });
});

describe("crash point from seed", () => {
  test("is deterministic and at least 1.0", () => {
    const { seeds } = generateChain(100);
    for (const s of seeds) {
      const a = crashPointFromSeed(s);
      const b = crashPointFromSeed(s);
      expect(a).toBe(b);
      expect(a).toBeGreaterThanOrEqual(1);
    }
  });

  test("preserves the house edge: bust rate and cashout RTP", () => {
    // deterministic seeds (sha256 of an index) so the measured rates are fixed rather
    // than a random sample that could occasionally fall outside the tolerance
    const N = 60000;
    let busts = 0;
    let return2x = 0; // a 2x cashout returns 2 per unit when crash >= 2
    let return10x = 0;
    for (let i = 0; i < N; i++) {
      const cp = crashPointFromSeed(sha256(`edge:${i}`));
      if (cp === 1.0) busts += 1;
      if (cp >= 2) return2x += 2;
      if (cp >= 10) return10x += 10;
    }

    // crash at exactly 1.0 combines the 3% instant bust and the curve's own floor (~1%)
    expect(busts / N).toBeGreaterThan(INSTANT_CRASH_CHANCE);
    expect(busts / N).toBeLessThan(0.05);
    // every cashout target returns ~0.96 per unit staked: the flat ~4% edge, not ~1.0
    expect(return2x / N).toBeGreaterThan(0.93);
    expect(return2x / N).toBeLessThan(0.99);
    expect(return10x / N).toBeGreaterThan(0.88);
    expect(return10x / N).toBeLessThan(1.02);
  });
});
