const { getWinningItem, addUniqueInfoToItem } = require("../../utils/caseOpening");

describe("case opening", () => {
  // only rarities 1 and 2 exist here, so the weighted pick will often land on an
  // empty bucket (3/4/5) and must fall back to an existing rarity
  const caseData = {
    items: [
      { _id: "a", name: "Common", image: "c.png", rarity: "1", case: "x" },
      { _id: "b", name: "Uncommon", image: "u.png", rarity: "2", case: "x" },
    ],
  };

  test("always returns one of the case's items (empty-bucket fallback)", () => {
    const names = new Set(caseData.items.map((i) => i.name));
    for (let i = 0; i < 2000; i++) {
      const won = getWinningItem(caseData);
      expect(won).toBeDefined();
      expect(names.has(won.name)).toBe(true);
    }
  });

  test("addUniqueInfoToItem assigns a unique id and keeps core fields", () => {
    const a = addUniqueInfoToItem(caseData.items[0]);
    const b = addUniqueInfoToItem(caseData.items[0]);
    expect(a.uniqueId).toBeTruthy();
    expect(a.uniqueId).not.toBe(b.uniqueId);
    expect(a.name).toBe("Common");
    expect(a.rarity).toBe("1");
    expect(a.case).toBe("x");
  });
});
