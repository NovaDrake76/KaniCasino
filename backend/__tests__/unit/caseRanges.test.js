const { buildRangeTable } = require("../../utils/caseRanges");
const { Rarities } = require("../../utils/caseOpening");
const { TOTAL } = require("../../utils/provablyFair");

const chance = (id) => Rarities.find((r) => r.id === id).chance;

const items = [
  { _id: "a1", rarity: "1" },
  { _id: "a2", rarity: "1" },
  { _id: "a3", rarity: "1" },
  { _id: "b1", rarity: "2" },
  { _id: "b2", rarity: "2" },
  { _id: "c1", rarity: "3" },
  { _id: "d1", rarity: "4" },
  { _id: "e1", rarity: "5" },
];

describe("buildRangeTable", () => {
  test("ranges are contiguous, cover [1, TOTAL], and are never zero-width", () => {
    const { rangeTable, total } = buildRangeTable({ items });
    expect(total).toBe(TOTAL);
    expect(rangeTable[0].start).toBe(1);
    expect(rangeTable[rangeTable.length - 1].end).toBe(TOTAL);
    let prev = 0;
    let widthSum = 0;
    for (const r of rangeTable) {
      expect(r.start).toBe(prev + 1); // contiguous, no gaps
      expect(r.end).toBeGreaterThanOrEqual(r.start); // width >= 1
      widthSum += r.end - r.start + 1;
      prev = r.end;
    }
    expect(widthSum).toBe(TOTAL);
  });

  test("widths reproduce the intended odds (rarityChance / itemsInRarity, all rarities present)", () => {
    const { rangeTable, total } = buildRangeTable({ items });
    const width = (id) => {
      const r = rangeTable.find((x) => x.itemId === id);
      return r.end - r.start + 1;
    };
    // all five rarities present -> S = 1, so prob(item) = chance_r / countInRarity
    const expectRatio = (id, prob) => {
      expect(Math.abs(width(id) / total - prob)).toBeLessThan(1e-4);
    };
    expectRatio("a1", chance("1") / 3);
    expectRatio("b1", chance("2") / 2);
    expectRatio("c1", chance("3"));
    expectRatio("d1", chance("4"));
    expectRatio("e1", chance("5"));
  });

  test("order is deterministic (rarity desc, then _id) and the config hash is stable", () => {
    const a = buildRangeTable({ items });
    const b = buildRangeTable({ items: [...items].reverse() });
    expect(a.configHash).toBe(b.configHash); // order-independent input, canonical output
    expect(a.rangeTable[0].rarity).toBe("5"); // highest rarity first
    expect(a.configHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("empty case yields an empty table and no hash", () => {
    const { rangeTable, configHash } = buildRangeTable({ items: [] });
    expect(rangeTable).toEqual([]);
    expect(configHash).toBeNull();
  });
});
