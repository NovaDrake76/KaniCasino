const {
  calculateSuccessRate,
  UPGRADE_RTP_BY_RARITY,
  UPGRADE_CEILING,
  UPGRADE_MAX_RARITY_GAP,
  verifyRarityGap,
} = require("../../games/upgrade");
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

// The legendary return is the one number that decides whether upgrading or opening is the
// cheaper way to get a legendary. It was 0.6, which made upgrading six times cheaper than
// the case, and most legendaries on the site were made rather than dropped. Pinned here
// because it is a single character to change back and nothing else would notice.
describe("what a legendary costs to upgrade into", () => {
  const TOTAL_CHANCE_R5 = 0.0026;

  it("returns 0.3, so items burnt per legendary is twice the case value", () => {
    expect(UPGRADE_RTP_BY_RARITY["5"]).toBe(0.3);
  });

  it("keeps upgrading dearer per legendary than it was, and still under the case price", () => {
    // value staked per legendary produced = target / rtp, in units of A
    const perLegendary = value(5) / UPGRADE_RTP_BY_RARITY["5"];
    const perOpenedLegendary = value(5) / TOTAL_CHANCE_R5 / (value(5) / 0.9);
    expect(perLegendary).toBeCloseTo(value(5) / 0.3, 10);
    // still the cheaper route, which is the point: it is a sink, not a wall
    expect(perLegendary).toBeLessThan(perOpenedLegendary * value(5));
  });

  it("halves the odds for a stake that used to sit under the ceiling", () => {
    // seventeen commons against a legendary: 10.2% before, 5.1% now
    const seventeen = staked(...Array(17).fill(1));
    expect(calculateSuccessRate(seventeen, value(5), 5)).toBeCloseTo((0.3 * seventeen) / value(5), 10);
    expect(calculateSuccessRate(seventeen, value(5), 5)).toBeLessThan(UPGRADE_CEILING["5"]);
  });

  it("leaves the best odds per attempt alone, only the stake that buys them", () => {
    const plenty = staked(...Array(200).fill(1));
    expect(calculateSuccessRate(plenty, value(5), 5)).toBe(UPGRADE_CEILING["5"]);
  });

  it("does not touch any other rarity", () => {
    expect(UPGRADE_RTP_BY_RARITY["1"]).toBe(0.9);
    expect(UPGRADE_RTP_BY_RARITY["2"]).toBe(0.9);
    expect(UPGRADE_RTP_BY_RARITY["3"]).toBe(0.85);
    expect(UPGRADE_RTP_BY_RARITY["4"]).toBe(0.75);
  });
});

// A pile of commons used to be a legitimate run at a legendary, and forty blues bought the
// 12% ceiling outright. That made the rarest items a grind rather than a milestone, so an
// item may now only be staked at something within two rarities of itself.
describe("how far above its own rarity an item may be staked", () => {
  const at = (source, target) => verifyRarityGap([{ rarity: String(source) }], { rarity: String(target) });

  it("stops commons and blues being aimed at a legendary", () => {
    expect(at(1, 5)).toEqual({ ok: false, reason: "gap" });
    expect(at(2, 5)).toEqual({ ok: false, reason: "gap" });
  });

  it("lets a legendary be fed the two tiers below it, which have to be earned first", () => {
    expect(at(3, 5)).toEqual({ ok: true });
    expect(at(4, 5)).toEqual({ ok: true });
    expect(at(5, 5)).toEqual({ ok: true });
  });

  it("still refuses to upgrade downwards, and says which mistake it was", () => {
    expect(at(5, 3)).toEqual({ ok: false, reason: "lesser" });
    expect(at(4, 1)).toEqual({ ok: false, reason: "lesser" });
  });

  it("holds for every pair, not just the ones around legendary", () => {
    for (const source of RARITIES) {
      for (const target of RARITIES) {
        const expected =
          source > target ? "lesser" : target - source > UPGRADE_MAX_RARITY_GAP ? "gap" : null;
        expect(at(source, target).reason || null).toBe(expected);
      }
    }
  });

  // one bad item in a pile of good ones has to fail the whole stake
  it("judges the worst item in the stake, not the best", () => {
    const stack = [{ rarity: "3" }, { rarity: "4" }, { rarity: "1" }];
    expect(verifyRarityGap(stack, { rarity: "5" })).toEqual({ ok: false, reason: "gap" });
  });

  it("is two", () => {
    expect(UPGRADE_MAX_RARITY_GAP).toBe(2);
  });
});
