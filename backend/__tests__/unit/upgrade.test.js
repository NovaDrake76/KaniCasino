const { calculateSuccessRate, MAX_UPGRADE_CHANCE } = require("../../games/upgrade");
const { RARITY_MULTIPLIER, UPGRADE_RTP } = require("../../utils/itemValue");

// within a case an item's value is A * RARITY_MULTIPLIER[rarity], so a rarity is worth
// its multiplier. A cancels out of every edge below, so it can be 1.
const value = (rarity) => RARITY_MULTIPLIER[String(rarity)];
const staked = (...rarities) => rarities.reduce((s, r) => s + value(r), 0);

// what the player gets back per unit staked
const edgeOf = (rarities, target) => {
  const inValue = staked(...rarities);
  const outValue = value(target);
  return 1 - (calculateSuccessRate(inValue, outValue) * outValue) / inValue;
};

const RARITIES = [1, 2, 3, 4, 5];

describe("upgrade success rate", () => {
  test("the edge is exactly 1 - UPGRADE_RTP for every rarity pair", () => {
    for (const from of RARITIES) {
      for (const to of RARITIES) {
        // skip the ones a big stake pushes into the cap; covered separately below
        if (calculateSuccessRate(value(from), value(to)) >= MAX_UPGRADE_CHANCE) continue;
        expect(edgeOf([from], to)).toBeCloseTo(1 - UPGRADE_RTP, 10);
      }
    }
  });

  test("no combination of rarities is ever player-positive", () => {
    // the old table paid the player +40% on 1x rarity-1 -> rarity-4, and stayed
    // player-positive on that trade for stacks of up to six
    for (const target of RARITIES) {
      for (const from of RARITIES) {
        for (let n = 1; n <= 30; n++) {
          const edge = edgeOf(Array(n).fill(from), target);
          expect(edge).toBeGreaterThanOrEqual(-1e-12);
        }
      }
    }
  });

  test("mixing colors does not move the edge", () => {
    const mixes = [
      [1, 4], [4, 1], [1, 1, 5], [3, 3, 1], [2, 3, 4], [1, 2, 3, 4, 5], [5, 1, 1, 1],
    ];
    for (const mix of mixes) {
      for (const target of RARITIES) {
        if (calculateSuccessRate(staked(...mix), value(target)) >= MAX_UPGRADE_CHANCE) continue;
        expect(edgeOf(mix, target)).toBeCloseTo(1 - UPGRADE_RTP, 10);
      }
    }
  });

  test("an extra item buys exactly the chance it pays for", () => {
    // adding a 1 KP rarity-1 to a 24 KP pair of rarity-3s used to buy 8.6% more chance
    // for 4% more value. the chance must now move in step with the stake.
    const before = calculateSuccessRate(staked(3, 3), value(4));
    const after = calculateSuccessRate(staked(3, 3, 1), value(4));
    expect(after / before).toBeCloseTo(staked(3, 3, 1) / staked(3, 3), 10);
  });

  test("order of items does not change the result", () => {
    expect(calculateSuccessRate(staked(1, 3, 2), value(4)))
      .toBe(calculateSuccessRate(staked(3, 2, 1), value(4)));
  });

  test("adding an item never lowers the rate", () => {
    for (const target of RARITIES) {
      let prev = 0;
      const pool = [1, 2, 3, 1, 2, 1];
      for (let n = 1; n <= pool.length; n++) {
        const rate = calculateSuccessRate(staked(...pool.slice(0, n)), value(target));
        expect(rate + 1e-12).toBeGreaterThanOrEqual(prev);
        prev = rate;
      }
    }
  });

  test("an oversized stake is capped rather than promised", () => {
    // 100x rarity-5 against a rarity-1 target would ask for a chance of 9000
    const rate = calculateSuccessRate(staked(...Array(100).fill(5)), value(1));
    expect(rate).toBe(MAX_UPGRADE_CHANCE);
    expect(rate).toBeLessThan(1);
  });

  test("a capped trade is still house-positive", () => {
    // overpaying is the player's own bad trade; it must never turn into a player edge
    expect(edgeOf(Array(100).fill(5), 1)).toBeGreaterThan(0);
    expect(edgeOf([4, 4], 4)).toBeGreaterThan(0);
  });

  test("worthless or missing values never produce a chance", () => {
    expect(calculateSuccessRate(0, 100)).toBe(0);
    expect(calculateSuccessRate(100, 0)).toBe(0);
    expect(calculateSuccessRate(undefined, 100)).toBe(0);
    expect(calculateSuccessRate(-5, 100)).toBe(0);
  });
});
