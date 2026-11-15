const crypto = require("crypto");
const {
  SLOTS,
  LINES,
  TICKETS,
  TREASURE_CELLS,
  isTicket,
  isStateful,
  validQuantity,
  validCell,
  slotFromFloat,
  rowForSlot,
  returnSlots,
  winOdds,
  topPayout,
  choose,
  weightedPick,
  blockedAt,
  allowedAt,
  resolveWith,
  resolveTicket,
  treasurePayout,
  findSymbol,
} = require("../../utils/scratchMath");

const IDS = ["pocket", "nine", "treasure"];

// a float that lands exactly on a slot, for the cursor-0 draw
const atSlot = (slot) => (slot + 0.5) / SLOTS;

// many seeded tickets of one kind, the way the game draws them
const draws = (ticketId, n) => {
  const serverSeed = crypto.createHash("sha256").update(`scratch-${ticketId}`).digest("hex");
  return Array.from({ length: n }, (_, nonce) => resolveTicket(serverSeed, "client", nonce, ticketId));
};

const completeLines = (cells) => LINES.filter(([a, b, c]) => cells[a] === cells[b] && cells[b] === cells[c]);
const sorted = (list) => [...list].sort((a, b) => a - b);

describe("the three tables", () => {
  test("pocket sums multiplier x slots to exactly 960,000 and wins 39.35%", () => {
    expect(TICKETS.pocket.prizes.reduce((s, [, m, slots]) => s + m * slots, 0)).toBe(960000);
    expect(returnSlots("pocket")).toBe(960000);
    expect(winOdds("pocket")).toEqual([393500, SLOTS]);
  });

  test("nine sums pays x slots to exactly 960,000 and wins 34.658%", () => {
    const pays = TICKETS.nine.outcomes.map(([, matched, mult]) => mult * matched.reduce((s, m) => s + m, 0));
    expect(pays).toEqual([1, 2, 2, 2, 3, 3, 5, 5, 9, 10, 10, 18, 25, 45, 100, 100, 900, 1000]);
    expect(TICKETS.nine.outcomes.reduce((s, [slots], i) => s + slots * pays[i], 0)).toBe(960000);
    expect(returnSlots("nine")).toBe(960000);
    expect(winOdds("nine")).toEqual([346580, SLOTS]);
  });

  test("treasure's boards fill a million slots, sum to 2,880,000,000, and three picks return 96%", () => {
    const boards = TICKETS.treasure.boards;
    expect(boards.reduce((s, [slots]) => s + slots, 0)).toBe(SLOTS);
    expect(boards.reduce((s, [slots, finds]) => s + slots * finds.reduce((a, f) => a + f, 0), 0)).toBe(2880000000);
    expect(returnSlots("treasure")).toBe(960000);
    for (const [, finds] of boards) expect(finds.length).toBeLessThanOrEqual(TREASURE_CELLS);
  });

  test("the 96% identity holds over all 84 three-spot choices of every board, weighted by slots", () => {
    const triples = [];
    for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) for (let c = b + 1; c < 9; c++) triples.push([a, b, c]);
    expect(triples).toHaveLength(84);
    let total = 0;
    for (const [slots, finds] of TICKETS.treasure.boards) {
      const board = [...finds, ...Array(9 - finds.length).fill(0)];
      const sumOverChoices = triples.reduce((s, picks) => s + treasurePayout(board, picks), 0);
      total += slots * sumOverChoices;
    }
    // 0.96 x the 1,000 price x 84 choices x a million slots, in whole numbers
    expect(total).toBe(96 * 10 * 84 * SLOTS);
  });

  test("treasure pays its price or more in 29,670,625 of 84,000,000 three-spot choices", () => {
    expect(winOdds("treasure")).toEqual([29670625, 84000000]);
    // counted by hand over every board and every choice: nothing, under the price, the price back, more
    const split = [0, 0, 0, 0];
    for (const [slots, finds] of TICKETS.treasure.boards) {
      const board = [...finds, ...Array(9 - finds.length).fill(0)];
      for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) for (let c = b + 1; c < 9; c++) {
        const paid = treasurePayout(board, [a, b, c]);
        split[paid === 0 ? 0 : paid < 1000 ? 1 : paid === 1000 ? 2 : 3] += slots;
      }
    }
    expect(split).toEqual([21280625, 33048750, 16183750, 13486875]);
    expect(split[2] + split[3]).toBe(winOdds("treasure")[0]);
    expect(choose(9, 3)).toBe(84);
    expect(choose(7, 3)).toBe(35);
    expect(choose(4, 3)).toBe(4);
  });

  test("prices and top payouts", () => {
    expect(IDS.map((id) => TICKETS[id].price)).toEqual([10, 100, 1000]);
    expect(IDS.map(topPayout)).toEqual([1000, 100000, 300000]);
  });

  test("only the three tickets pass, and treasure is bought one at a time", () => {
    for (const id of IDS) expect(isTicket(id)).toBe(true);
    for (const bad of ["", "classic", "gold", "Pocket", "constructor", "toString", null, undefined, 1]) expect(isTicket(bad)).toBe(false);
    for (const q of [1, 3, 5, 10]) expect(validQuantity("pocket", q)).toBe(true);
    for (const q of [0, 11, -1, 1.5, "1", null, undefined, NaN]) expect(validQuantity("nine", q)).toBe(false);
    expect(validQuantity("treasure", 1)).toBe(true);
    expect(validQuantity("treasure", 3)).toBe(false);
    expect(isStateful("treasure")).toBe(true);
    expect(isStateful("pocket")).toBe(false);
    for (const c of [0, 4, 8]) expect(validCell(c)).toBe(true);
    for (const c of [-1, 9, 1.5, "1", null]) expect(validCell(c)).toBe(false);
  });
});

describe("the weighted pick", () => {
  test("walks whole units of the total, so each item owns exactly its weight of the float", () => {
    const list = ["a", "b", "c"];
    const weights = [5, 3, 2];
    expect(weightedPick(list, weights, 0)).toBe("a");
    expect(weightedPick(list, weights, 0.4999)).toBe("a");
    expect(weightedPick(list, weights, 0.5)).toBe("b");
    expect(weightedPick(list, weights, 0.7999)).toBe("b");
    expect(weightedPick(list, weights, 0.8)).toBe("c");
    expect(weightedPick(list, weights, 0.9999999999)).toBe("c");
    expect(weightedPick(["only"], [4], 0.73)).toBe("only");
  });

  test("the weights are the approved ones, one per printable prize and one per pocket symbol", () => {
    expect(TICKETS.nine.decoyWeights).toEqual([30, 25, 18, 12, 7, 4, 3, 1]);
    expect(TICKETS.nine.decoyWeights).toHaveLength(TICKETS.nine.printable.length);
    expect(TICKETS.pocket.fillers).toEqual({ star: 30, clover: 25, coins: 20, gem: 13, chest: 8, crown: 4 });
    expect(Object.keys(TICKETS.pocket.fillers).sort()).toEqual(TICKETS.pocket.prizes.map(([s]) => s).sort());
  });
});

describe("the cursor-0 draw", () => {
  test("a float maps to 0..999999 and the walk starts at the rarest row", () => {
    expect(slotFromFloat(0)).toBe(0);
    expect(slotFromFloat(0.9999999999)).toBe(SLOTS - 1);
    const prizes = TICKETS.pocket.prizes;
    const of = ([, , slots]) => slots;
    expect(prizes[rowForSlot(prizes, of, 0)][0]).toBe("crown");
    expect(prizes[rowForSlot(prizes, of, 499)][0]).toBe("crown");
    expect(prizes[rowForSlot(prizes, of, 500)][0]).toBe("chest");
    expect(prizes[rowForSlot(prizes, of, 393499)][0]).toBe("star");
    expect(rowForSlot(prizes, of, 393500)).toBe(-1);
    const boards = TICKETS.treasure.boards;
    expect(rowForSlot(boards, ([slots]) => slots, 0)).toBe(boards.length - 1);
    expect(rowForSlot(boards, ([slots]) => slots, SLOTS - 1)).toBe(0);
  });
});

describe("pocket change", () => {
  test("no cell can run out of symbols: at most four lines cross a cell, against six symbols", () => {
    for (let cell = 0; cell < 9; cell++) {
      expect(LINES.filter((line) => line.includes(cell)).length).toBeLessThanOrEqual(4);
      expect(TICKETS.pocket.prizes.length - 4).toBeGreaterThanOrEqual(2);
      const worst = Array(9).fill(null);
      const symbols = TICKETS.pocket.prizes.map(([s]) => s);
      LINES.filter((line) => line.includes(cell)).forEach((line, k) => {
        for (const c of line) if (c !== cell) worst[c] = symbols[k];
      });
      expect(blockedAt(worst, cell).size).toBeLessThanOrEqual(4);
    }
  });

  test("a win shows exactly one complete line, of the prize symbol, and a loss shows none", () => {
    let wins = 0;
    for (const t of draws("pocket", 6000)) {
      const lines = completeLines(t.cells);
      expect(t.cells.every((s) => TICKETS.pocket.prizes.some(([symbol]) => symbol === s))).toBe(true);
      if (t.multiplier) {
        wins += 1;
        expect(lines).toHaveLength(1);
        expect(t.cells[lines[0][0]]).toBe(t.symbol);
        expect(lines[0]).toEqual(t.line);
        expect(t.winningCells).toEqual(t.line);
        expect(t.payout).toBe(t.multiplier * 10);
      } else {
        expect(lines).toHaveLength(0);
        expect(t.line).toBeNull();
        expect(t.payout).toBe(0);
      }
    }
    expect(wins).toBeGreaterThan(2000);
    expect(wins).toBeLessThan(2750);
  });

  test("every filler is drawn from a non-empty set that cannot finish a line, so no losing ticket ever shows one", () => {
    let losses = 0;
    for (const t of draws("pocket", 6000)) {
      // the grid as it stood when cell c was drawn: the winning line, then the fillers before c
      const before = (c) => t.cells.map((s, i) => (t.winningCells.includes(i) || i < c ? s : null));
      for (let c = 0; c < 9; c++) {
        if (t.winningCells.includes(c)) continue;
        const allowed = allowedAt(before(c), c);
        expect(allowed.length).toBeGreaterThanOrEqual(2);
        expect(allowed).toContain(t.cells[c]);
      }
      if (!t.multiplier) {
        losses += 1;
        expect(completeLines(t.cells)).toEqual([]);
      }
    }
    expect(losses).toBeGreaterThan(3000);
  });

  test("crowns fill a cell about as rarely as their weight says", () => {
    const counts = {};
    let fillers = 0;
    for (const t of draws("pocket", 6000)) {
      t.cells.forEach((s, c) => {
        if (t.winningCells.includes(c)) return;
        counts[s] = (counts[s] || 0) + 1;
        fillers += 1;
      });
    }
    // 4 in 100, nudged up a little by the cells where a more common symbol is blocked
    expect(counts.crown / fillers).toBeGreaterThan(0.035);
    expect(counts.crown / fillers).toBeLessThan(0.052);
    expect(counts.star / fillers).toBeGreaterThan(0.25);
    expect(counts.star).toBeGreaterThan(counts.clover);
    expect(counts.clover).toBeGreaterThan(counts.coins);
    expect(counts.coins).toBeGreaterThan(counts.gem);
    expect(counts.gem).toBeGreaterThan(counts.chest);
    expect(counts.chest).toBeGreaterThan(counts.crown);
  });

  test("the top prize at slot 0 lays three crowns on the drawn line", () => {
    const t = resolveWith((cursor) => (cursor === 0 ? atSlot(0) : 0.999), "pocket");
    expect(t.symbol).toBe("crown");
    expect(t.payout).toBe(1000);
    expect(t.line).toEqual(LINES[7]);
    expect(completeLines(t.cells)).toEqual([LINES[7]]);
  });

  test("the same seed always lays the same grid", () => {
    expect(draws("pocket", 50)).toEqual(draws("pocket", 50));
  });
});

describe("perfect nine", () => {
  const ninePool = TICKETS.nine.pool;
  const printable = TICKETS.nine.printable.map((m) => m * 100);

  test("matched spots and only they show a lucky symbol, and the payout is the multiplier times their sum", () => {
    let wins = 0;
    for (const t of draws("nine", 6000)) {
      expect(t.lucky).toHaveLength(2);
      expect(t.lucky[0]).not.toBe(t.lucky[1]);
      for (const s of t.lucky) expect(ninePool).toContain(s);
      expect(t.spots).toHaveLength(8);
      const luckySpots = t.spots.map((s, i) => (t.lucky.includes(s.symbol) ? i : -1)).filter((i) => i >= 0);
      expect(luckySpots).toEqual(t.winningSpots);
      const sum = t.winningSpots.reduce((s, i) => s + t.spots[i].prize, 0);
      expect(t.payout).toBe(t.multiplier * sum);
      for (const [i, spot] of t.spots.entries()) {
        expect(ninePool).toContain(spot.symbol);
        if (!t.winningSpots.includes(i)) {
          expect(t.lucky).not.toContain(spot.symbol);
          expect(printable).toContain(spot.prize);
        }
      }
      if (t.payout > 0) wins += 1;
      else {
        expect(t.winningSpots).toEqual([]);
        expect(TICKETS.nine.lossMultipliers).toContain(t.multiplier);
      }
    }
    expect(wins).toBeGreaterThan(1850);
    expect(wins).toBeLessThan(2300);
  });

  test("every outcome row lays out the prizes it promises", () => {
    let edge = 0;
    for (let row = TICKETS.nine.outcomes.length - 1; row >= 0; row--) {
      const [slots, matched, multiplier] = TICKETS.nine.outcomes[row];
      const slot = edge;
      edge += slots;
      const t = resolveWith((cursor) => (cursor === 0 ? atSlot(slot) : ((cursor * 0.137) % 1)), "nine");
      expect(t.multiplier).toBe(multiplier);
      expect(sorted(t.winningSpots.map((i) => t.spots[i].prize / 100))).toEqual(sorted(matched));
      expect(t.payout).toBe(multiplier * matched.reduce((s, m) => s + m, 0) * 100);
    }
    expect(edge).toBe(346580);
    const loss = resolveWith((cursor) => (cursor === 0 ? atSlot(346580) : 0.5), "nine");
    expect(loss.payout).toBe(0);
    expect(loss.winningSpots).toEqual([]);
  });

  test("decoys show every other symbol and every printable prize, the big ones as rarely as their weights", () => {
    const seenSymbols = new Set();
    const prizes = {};
    let decoys = 0;
    for (const t of draws("nine", 6000)) {
      t.spots.forEach((spot, i) => {
        if (t.winningSpots.includes(i)) return;
        seenSymbols.add(spot.symbol);
        prizes[spot.prize] = (prizes[spot.prize] || 0) + 1;
        decoys += 1;
      });
    }
    expect([...seenSymbols].sort()).toEqual([...ninePool].sort());
    expect(sorted(Object.keys(prizes).map(Number))).toEqual(printable);
    // 1 in 100 decoys is the 1000x, 30 in 100 the price
    expect(prizes[100000] / decoys).toBeGreaterThan(0.008);
    expect(prizes[100000] / decoys).toBeLessThan(0.012);
    expect(prizes[100] / decoys).toBeGreaterThan(0.28);
    expect(prizes[100] / decoys).toBeLessThan(0.32);
  });

  test("the same seed always lays the same board", () => {
    expect(draws("nine", 50)).toEqual(draws("nine", 50));
  });
});

describe("borrowed treasure", () => {
  test("every board holds exactly the finds of its row, dealt over the nine spots", () => {
    for (const t of draws("treasure", 3000)) {
      const finds = TICKETS.treasure.boards[t.row][1];
      expect(t.board).toHaveLength(9);
      expect(sorted(t.board.filter((v) => v > 0))).toEqual(sorted(finds));
      expect(t.board.filter((v) => v === 0)).toHaveLength(9 - finds.length);
    }
  });

  test("each row is drawn at its slot, and the shuffle follows cursors 1..8", () => {
    let edge = 0;
    for (let row = TICKETS.treasure.boards.length - 1; row >= 0; row--) {
      const t = resolveWith((cursor) => (cursor === 0 ? atSlot(edge) : 0), "treasure");
      expect(t.row).toBe(row);
      edge += TICKETS.treasure.boards[row][0];
    }
    // j = 0 at every step swaps each spot from the last down with spot 0
    const t = resolveWith((cursor) => (cursor === 0 ? atSlot(0) : 0), "treasure");
    expect(t.board).toEqual([100000, 100000, 10000, 2500, 0, 0, 0, 0, 100000]);
  });

  test("the same seed always deals the same board", () => {
    expect(draws("treasure", 50)).toEqual(draws("treasure", 50));
  });

  test("the payout is the sum of the picked spots", () => {
    const board = [0, 500, 0, 1000, 0, 2500, 0, 0, 500];
    expect(treasurePayout(board, [1, 3, 8])).toBe(2000);
    expect(treasurePayout(board, [0, 2, 4])).toBe(0);
    expect(findSymbol(100000)).toBe("hakkero");
    expect(findSymbol(0)).toBeNull();
  });
});
