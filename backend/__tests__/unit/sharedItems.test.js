const { planSharedItems, sharedKey } = require("../../utils/sharedItems");

const tiers = (names) => names.map(([name, rarity]) => ({ name, rarity }));
// every tier present, so a 200 KP case gives each rarity the same value wherever it is
const full = (extra) => tiers([["a", "1"], ["b", "2"], ["c", "3"], ["d", "4"], ["e", "5"], ...extra]);

describe("planning cases that share items", () => {
  test("a name repeated in one category is the same item", () => {
    const { cases, problems } = planSharedItems([
      { title: "2023", price: 200, category: "Anime", items: full([["Frieren", "5"]]) },
      { title: "2026", price: 200, category: "Anime", items: tiers([["Frieren", "5"], ["x", "1"], ["y", "2"], ["z", "3"], ["w", "4"]]) },
    ]);
    expect(problems).toEqual([]);
    const frieren = cases[1].rows.find((r) => r.name === "Frieren");
    expect(frieren.sharedInSpec).toBe(true);
    expect(frieren.key).toBe(sharedKey("Anime", "Frieren"));
  });

  test("one item cannot have two rarities", () => {
    const { problems } = planSharedItems([
      { title: "2023", price: 200, category: "Anime", items: full([["Frieren", "5"]]) },
      { title: "2026", price: 200, category: "Anime", items: full([["Frieren", "4"]]) },
    ]);
    expect(problems.some((p) => p.includes("Frieren") && p.includes("rarity"))).toBe(true);
  });

  test("one item cannot be worth two amounts", () => {
    const { problems } = planSharedItems([
      { title: "cheap", price: 60, category: "Anime", items: full([["Frieren", "5"]]) },
      { title: "dear", price: 200, category: "Anime", items: full([["Frieren", "5"]]) },
    ]);
    expect(problems.some((p) => p.includes("Frieren") && p.includes("worth"))).toBe(true);
  });

  test("an item already in the catalog is reused and must keep its rarity", () => {
    const existing = new Map([[sharedKey("Anime", "Rem"), { _id: "rem-id", rarity: "5", baseValue: 0 }]]);
    const ok = planSharedItems([{ title: "2026", price: 200, category: "Anime", items: full([["Rem", "5"]]) }], existing);
    expect(ok.problems).toEqual([]);
    expect(ok.cases[0].rows.find((r) => r.name === "Rem").reuse).toBe("rem-id");

    const bad = planSharedItems([{ title: "2026", price: 200, category: "Anime", items: full([["Rem", "4"]]) }], existing);
    expect(bad.problems.length).toBeGreaterThan(0);
  });

  test("the same name in another category is a different item", () => {
    const { cases } = planSharedItems([
      { title: "Lunatic", price: 60, category: "Touhou", items: full([["Kaguya", "5"]]) },
      { title: "2026", price: 200, category: "Anime", items: full([["Kaguya", "5"]]) },
    ]);
    expect(cases[1].rows.find((r) => r.name === "Kaguya").sharedInSpec).toBe(false);
  });
});
