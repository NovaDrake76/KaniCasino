const crypto = require("crypto");
const {
  TOTAL,
  FLOAT_BYTES,
  generateServerSeed,
  hashServerSeed,
  generateClientSeed,
  rollFloat,
  toRollInt,
  roll,
  pickFromRanges,
} = require("../../utils/provablyFair");

describe("provablyFair crypto core", () => {
  const serverSeed = "a".repeat(64);
  const clientSeed = "breno";

  test("server seed hash is sha256(serverSeed) (the commitment)", () => {
    const expected = crypto.createHash("sha256").update(serverSeed).digest("hex");
    expect(hashServerSeed(serverSeed)).toBe(expected);
    expect(hashServerSeed(serverSeed)).toHaveLength(64);
  });

  test("generated seeds have the expected shape", () => {
    expect(generateServerSeed()).toMatch(/^[0-9a-f]{64}$/);
    expect(generateClientSeed()).toMatch(/^[0-9a-f]{32}$/);
    expect(generateServerSeed()).not.toBe(generateServerSeed());
  });

  test("rollFloat is deterministic and in [0,1)", () => {
    const a = rollFloat(serverSeed, clientSeed, 7);
    const b = rollFloat(serverSeed, clientSeed, 7);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });

  test("nonce and cursor produce independent draws", () => {
    expect(rollFloat(serverSeed, clientSeed, 1)).not.toBe(rollFloat(serverSeed, clientSeed, 2));
    expect(rollFloat(serverSeed, clientSeed, 1, 0)).not.toBe(rollFloat(serverSeed, clientSeed, 1, 1));
  });

  test("rollFloat matches an independent third-party reproduction", () => {
    // recompute the same way a verifier would, to prove reproducibility
    const digest = crypto
      .createHmac("sha256", serverSeed)
      .update(`${clientSeed}:42:0`)
      .digest();
    let expected = 0;
    for (let i = 0; i < FLOAT_BYTES; i++) expected += digest[i] / 256 ** (i + 1);
    expect(rollFloat(serverSeed, clientSeed, 42)).toBe(expected);
  });

  test("toRollInt / roll stay within [1, total]", () => {
    expect(toRollInt(0, TOTAL)).toBe(1);
    expect(toRollInt(0.9999999999, TOTAL)).toBeLessThanOrEqual(TOTAL);
    for (let n = 0; n < 2000; n++) {
      const r = roll(serverSeed, clientSeed, n);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(TOTAL);
    }
  });

  test("rolls are ~uniform over the range (deterministic chi-square)", () => {
    const BUCKETS = 100;
    const N = 100000;
    const counts = new Array(BUCKETS).fill(0);
    for (let n = 0; n < N; n++) {
      const r = roll(serverSeed, clientSeed, n); // 1..TOTAL
      const bucket = Math.floor(((r - 1) / TOTAL) * BUCKETS);
      counts[bucket]++;
    }
    const expected = N / BUCKETS;
    const chiSq = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    // df = 99; a uniform source sits near 99. gross bias would blow this up.
    expect(chiSq).toBeLessThan(200);
  });

  describe("pickFromRanges", () => {
    const table = [
      { itemId: "a", start: 1, end: 10000 },
      { itemId: "b", start: 10001, end: 55000 },
      { itemId: "c", start: 55001, end: 100000 },
    ];

    test("selects the item whose range contains the roll", () => {
      expect(pickFromRanges(1, table).itemId).toBe("a");
      expect(pickFromRanges(10000, table).itemId).toBe("a");
      expect(pickFromRanges(10001, table).itemId).toBe("b");
      expect(pickFromRanges(55000, table).itemId).toBe("b");
      expect(pickFromRanges(55001, table).itemId).toBe("c");
      expect(pickFromRanges(100000, table).itemId).toBe("c");
    });

    test("reproduces the worked example: 66945 -> C", () => {
      expect(pickFromRanges(66945, table).itemId).toBe("c");
    });
  });
});
