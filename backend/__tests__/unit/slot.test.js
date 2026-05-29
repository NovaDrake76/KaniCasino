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

  test("a grid with no matching payline pays nothing", () => {
    const grid = ["red", "blue", "green", "blue", "yellow", "red", "green", "red", "blue"];
    expect(SlotGameController.calculateWins(grid)).toHaveLength(0);
  });

  test("generated grids only contain valid symbols", () => {
    const valid = new Set(["red", "blue", "green", "yin_yang", "hakkero", "yellow", "wild"]);
    for (let i = 0; i < 200; i++) {
      const grid = SlotGameController.generateRandomGrid();
      expect(grid).toHaveLength(9);
      expect(grid.every((s) => valid.has(s))).toBe(true);
    }
  });
});
