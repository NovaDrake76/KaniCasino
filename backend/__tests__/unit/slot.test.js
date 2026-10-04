const SlotGameController = require("../../games/slot");

describe("slot win calculation", () => {
  test("a uniform grid wins all five paylines", () => {
    const grid = Array(9).fill("blue");
    const wins = SlotGameController.calculateWins(grid);
    expect(wins).toHaveLength(5); // 3 rows + 2 diagonals
    expect(wins.every((w) => w.payout === 1)).toBe(true);
  });

  test("wild substitutes into a line", () => {
    // top row: wild, blue, blue -> counts as blue
    const grid = ["wild", "blue", "blue", "red", "green", "yellow", "green", "red", "yellow"];
    const wins = SlotGameController.calculateWins(grid);
    const topRow = wins.find((w) => w.line === "Horizontal 1");
    expect(topRow).toBeDefined();
    expect(topRow.payout).toBe(1);
  });

  // the slot page prints this table (src/pages/Slot/symbols.ts), so the two change together
  test("three of a kind pays the published multiplier", () => {
    const published = { wild: 100, yellow: 25, hakkero: 12, yin_yang: 8, green: 3, blue: 1, red: 0.5 };
    for (const [symbol, pays] of Object.entries(published)) {
      const grid = [symbol, symbol, symbol, "blue", "red", "green", "green", "hakkero", "blue"];
      expect(SlotGameController.calculateWins(grid)).toEqual([{ line: "Horizontal 1", payout: pays }]);
    }
  });

  test("a grid with no matching payline pays nothing", () => {
    const grid = ["red", "blue", "green", "blue", "yellow", "red", "green", "red", "blue"];
    expect(SlotGameController.calculateWins(grid)).toHaveLength(0);
  });

  test("generated grids are deterministic and only contain valid symbols", () => {
    const valid = new Set(["red", "blue", "green", "yin_yang", "hakkero", "yellow", "wild"]);
    const serverSeed = "s".repeat(64);
    for (let i = 0; i < 200; i++) {
      const grid = SlotGameController.generateGrid(serverSeed, "client", i);
      expect(grid).toHaveLength(9);
      expect(grid.every((s) => valid.has(s))).toBe(true);
    }
    // same seed + nonce reproduces the same grid
    expect(SlotGameController.generateGrid(serverSeed, "client", 7)).toEqual(
      SlotGameController.generateGrid(serverSeed, "client", 7)
    );
  });
});
