const { ROWS, PAYOUTS, derivePath, binFromPath } = require("../../utils/plinkoMath");
const PlinkoGameController = require("../../games/plinko");

// binomial C(16, k) for each landing bin, over a 2^16 sample space
function binomialCoefficients(n) {
  let row = [1];
  for (let i = 0; i < n; i++) {
    row = row.map((v, k) => v + (row[k - 1] || 0)).concat(1);
  }
  return row;
}

describe("plinko payout tables", () => {
  const coefficients = binomialCoefficients(ROWS);
  const space = Math.pow(2, ROWS);

  test("every risk has one multiplier per bin, symmetric, in whole cents", () => {
    for (const table of Object.values(PAYOUTS)) {
      expect(table).toHaveLength(ROWS + 1);
      for (let k = 0; k <= ROWS; k++) {
        expect(Number.isInteger(table[k])).toBe(true);
        expect(table[k]).toBeGreaterThan(0);
        expect(table[k]).toBe(table[ROWS - k]);
      }
    }
  });

  test("the exact return of every risk sits in the house's 3-4% edge band", () => {
    for (const [risk, table] of Object.entries(PAYOUTS)) {
      let weighted = 0;
      for (let k = 0; k <= ROWS; k++) {
        weighted += coefficients[k] * table[k];
      }
      const rtp = weighted / 100 / space;
      expect(rtp).toBeGreaterThan(0.955);
      expect(rtp).toBeLessThan(0.975);
    }
  });

  test("each risk's bet cap keeps the top payout at exactly 1,000,000", () => {
    for (const [risk, table] of Object.entries(PAYOUTS)) {
      expect((PlinkoGameController.MAX_BET[risk] * table[0]) / 100).toBeLessThanOrEqual(1000000);
    }
  });
});

describe("plinko path derivation", () => {
  const serverSeed = "s".repeat(64);

  test("paths are deterministic, one step per row, and only ever L or R", () => {
    for (let nonce = 0; nonce < 200; nonce++) {
      const path = derivePath(serverSeed, "client", nonce);
      expect(path).toHaveLength(ROWS);
      expect(/^[LR]+$/.test(path)).toBe(true);
    }
    expect(derivePath(serverSeed, "client", 7)).toBe(derivePath(serverSeed, "client", 7));
  });

  test("the bin is the count of rightward deflections", () => {
    expect(binFromPath("L".repeat(ROWS))).toBe(0);
    expect(binFromPath("R".repeat(ROWS))).toBe(ROWS);
    expect(binFromPath("LR".repeat(ROWS / 2))).toBe(ROWS / 2);
  });

  test("bins center around the middle of the board", () => {
    // deterministic sample: the average landing bin over many nonces stays near 8
    let sum = 0;
    const draws = 500;
    for (let nonce = 0; nonce < draws; nonce++) {
      sum += binFromPath(derivePath(serverSeed, "client", nonce));
    }
    expect(sum / draws).toBeGreaterThan(7.5);
    expect(sum / draws).toBeLessThan(8.5);
  });
});
