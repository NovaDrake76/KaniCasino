const { coinResultFromSeed, PURPLE_CHANCE, PURPLE_RESULT } = require("../../utils/coinMath");
const { payoutFor, winPayout, PURPLE_MULTIPLIER } = require("../../games/coinFlip");
const { sha256 } = require("../../utils/hashChain");

const seeds = Array.from({ length: 20000 }, (_, i) => sha256(`purple-${i}`));

describe("the purple side of the coin", () => {
  test("version 1 never lands purple, whatever the seed", () => {
    for (const seed of seeds.slice(0, 2000)) expect([0, 1]).toContain(coinResultFromSeed(seed, 1));
  });

  test("version 2 lands purple about three flips in a hundred", () => {
    const purple = seeds.filter((s) => coinResultFromSeed(s, 2) === PURPLE_RESULT).length / seeds.length;
    expect(purple).toBeGreaterThan(PURPLE_CHANCE - 0.005);
    expect(purple).toBeLessThan(PURPLE_CHANCE + 0.005);
  });

  test("heads and tails stay even with each other under version 2", () => {
    const sides = seeds.map((s) => coinResultFromSeed(s, 2)).filter((r) => r !== PURPLE_RESULT);
    const heads = sides.filter((r) => r === 0).length / sides.length;
    expect(heads).toBeGreaterThan(0.48);
    expect(heads).toBeLessThan(0.52);
  });

  test("a flip that is not purple lands the same side it did under version 1", () => {
    for (const seed of seeds.slice(0, 2000)) {
      const v2 = coinResultFromSeed(seed, 2);
      if (v2 !== PURPLE_RESULT) expect(v2).toBe(coinResultFromSeed(seed, 1));
    }
  });
});

describe("what version 2 pays", () => {
  test("a colour pays a flat 2x and purple pays its multiplier", () => {
    expect(payoutFor(100, "heads", 2)).toBe(200);
    expect(payoutFor(100, "tails", 2)).toBe(200);
    expect(payoutFor(100, "purple", 2)).toBe(100 * PURPLE_MULTIPLIER);
  });

  test("the edge stays in the house's favour on every side", () => {
    // a colour lands (1 - p) / 2 of the time, purple p of the time
    const colourReturn = ((1 - PURPLE_CHANCE) / 2) * payoutFor(1000, "heads", 2) / 1000;
    const purpleReturn = PURPLE_CHANCE * payoutFor(1000, "purple", 2) / 1000;
    expect(colourReturn).toBeCloseTo(0.97, 3);
    expect(purpleReturn).toBeCloseTo(0.96, 3);
  });

  test("a round from before the change still pays the old way", () => {
    expect(payoutFor(100, "heads", 1)).toBe(winPayout(100));
    expect(payoutFor(100, "heads")).toBe(winPayout(100));
  });
});
