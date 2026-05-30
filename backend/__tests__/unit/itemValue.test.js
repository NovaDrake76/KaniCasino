const { baseValuesForCase, sellValue, RTP } = require("../../utils/itemValue");
const { Rarities } = require("../../utils/caseOpening");

const chance = (r) => Rarities.find((x) => x.id === String(r)).chance;
const mkCase = (price, rarities) => ({
  price,
  items: rarities.map((r, i) => ({ _id: "i" + i, rarity: String(r) })),
});

describe("item base value", () => {
  test("expected value of an open is about price * RTP", () => {
    const price = 100;
    const c = mkCase(price, [1, 2, 3, 4, 5]); // one of each, all rarities present
    const v = baseValuesForCase(c);
    const ev = c.items.reduce((s, it) => s + chance(it.rarity) * v[String(it._id)], 0);
    expect(ev).toBeGreaterThan(price * RTP - 5);
    expect(ev).toBeLessThan(price * RTP + 5);
  });

  test("rarer items are worth more", () => {
    const c = mkCase(100, [1, 2, 3, 4, 5]);
    const v = baseValuesForCase(c);
    const vals = c.items.map((it) => v[String(it._id)]);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });

  test("value scales with case price", () => {
    const a = baseValuesForCase(mkCase(100, [1, 2, 3]));
    const b = baseValuesForCase(mkCase(200, [1, 2, 3]));
    expect(Math.abs(b["i0"] - 2 * a["i0"])).toBeLessThanOrEqual(2); // ~double, allow rounding
  });

  test("renormalizes when rarities are missing, EV still ~price*RTP", () => {
    const price = 50;
    const c = mkCase(price, [1, 2]); // only commons and rares
    const v = baseValuesForCase(c);
    const total = chance(1) + chance(2);
    const ev = c.items.reduce((s, it) => s + (chance(it.rarity) / total) * v[String(it._id)], 0);
    expect(ev).toBeGreaterThan(price * RTP - 3);
    expect(ev).toBeLessThan(price * RTP + 3);
  });

  test("empty / priceless cases yield no values", () => {
    expect(baseValuesForCase({ price: 100, items: [] })).toEqual({});
    expect(baseValuesForCase({ price: 0, items: [{ _id: "x", rarity: "1" }] })).toEqual({});
  });

  test("sell value applies the 75% haircut, floored", () => {
    expect(sellValue(100)).toBe(75);
    expect(sellValue(0)).toBe(0);
    expect(sellValue(33)).toBe(24); // floor(24.75)
  });
});
