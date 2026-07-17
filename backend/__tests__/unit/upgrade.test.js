const { calculateSuccessRate, UPGRADE_RTP_BY_RARITY, UPGRADE_CEILING } = require("../../games/upgrade");
const { RARITY_MULTIPLIER } = require("../../utils/itemValue");

// within a case an item's value is A * RARITY_MULTIPLIER[rarity], so a rarity is worth its
// multiplier. A cancels out of every edge below, so it can be 1.
const value = (rarity) => RARITY_MULTIPLIER[String(rarity)];
const staked = (...rarities) => rarities.reduce((s, r) => s + value(r), 0);

const rateOf = (rarities, target) => calculateSuccessRate(staked(...rarities), value(target), target);
const edgeOf = (rarities, target) => 1 - (rateOf(rarities, target) * value(target)) / staked(...rarities);

const RARITIES = [1, 2, 3, 4, 5];
const atCeiling = (rarities, target) => rateOf(rarities, target) >= UPGRADE_CEILING[String(target)] - 1e-12;

describe("upgrade success rate", () => {
  test("below its ceiling, the edge is exactly 1 - RTP for the target rarity", () => {
    for (const target of RARITIES) {
      // one rarity-1 item is a small enough stake to stay under every ceiling
      if (atCeiling([1], target)) continue;
      expect(edgeOf([1], target)).toBeCloseTo(1 - UPGRADE_RTP_BY_RARITY[String(target)], 10);
    }
  });

  test("both the edge and the ceiling get worse as the target rarity climbs", () => {
    for (let r = 2; r <= 5; r++) {
      expect(UPGRADE_RTP_BY_RARITY[String(r)]).toBeLessThanOrEqual(UPGRADE_RTP_BY_RARITY[String(r - 1)]);
      expect(UPGRADE_CEILING[String(r)]).toBeLessThan(UPGRADE_CEILING[String(r - 1)]);
    }
    // the top tier is a genuine long shot, not a near-certainty
    expect(UPGRADE_CEILING["5"]).toBeLessThanOrEqual(0.15);
  });

  test("stacking cheap items cannot beat the ceiling of a rare target", () => {
    // a hundred rarity-1 items poured into a rarity-5: the old flat cap gave ~0.95
    const rate = calculateSuccessRate(staked(...Array(100).fill(1)), value(5), 5);
    expect(rate).toBe(UPGRADE_CEILING["5"]);
    expect(rate).toBeLessThanOrEqual(0.12);
  });

  test("no combination of rarities is ever player-positive", () => {
    for (const target of RARITIES) {
      for (const from of RARITIES) {
        for (let n = 1; n <= 40; n++) {
          expect(edgeOf(Array(n).fill(from), target)).toBeGreaterThanOrEqual(-1e-12);
        }
      }
    }
  });

  test("mixing colors does not move the rate for a given target and stake", () => {
    // same total value, different mixes, both under the ceiling -> identical rate
    const target = 4; // ceiling reached only well above these stakes
    expect(rateOf([3, 1], target)).toBeCloseTo(rateOf([2, 2, 2, 1], target), 10);
  });

  test("adding an item never lowers the rate", () => {
    for (const target of RARITIES) {
      let prev = 0;
      const pool = [1, 2, 3, 1, 2, 1];
      for (let n = 1; n <= pool.length; n++) {
        const rate = calculateSuccessRate(staked(...pool.slice(0, n)), value(target), target);
        expect(rate + 1e-12).toBeGreaterThanOrEqual(prev);
        prev = rate;
      }
    }
  });

  test("an oversized stake is capped at the target's ceiling, not promised", () => {
    const rate = calculateSuccessRate(staked(...Array(100).fill(5)), value(1), 1);
    expect(rate).toBe(UPGRADE_CEILING["1"]);
    expect(rate).toBeLessThan(1);
  });

  test("worthless or missing values never produce a chance", () => {
    expect(calculateSuccessRate(0, 100, 5)).toBe(0);
    expect(calculateSuccessRate(100, 0, 5)).toBe(0);
    expect(calculateSuccessRate(undefined, 100, 5)).toBe(0);
    expect(calculateSuccessRate(-5, 100, 5)).toBe(0);
  });
});
