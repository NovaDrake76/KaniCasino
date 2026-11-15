import { describe, it, expect } from "vitest";
import { SLOTS, TICKETS, choose, isTicketId, kpText, ninePays, oneIn, payoutSplit, quantitiesOf, returnSlots, ticketOf, topPrize, winOdds } from "./scratchTickets";

// the same sums the backend's scratchMath test asserts, so a table edited on one side only fails here too
describe("the scratch tickets mirror", () => {
  it("returns exactly 96% on every ticket", () => {
    for (const t of TICKETS) expect(returnSlots(t)).toBe(0.96 * SLOTS);
  });

  it("sums each table the way the backend does", () => {
    const pocket = ticketOf("pocket");
    const nine = ticketOf("nine");
    const treasure = ticketOf("treasure");
    if (pocket.kind !== "line" || nine.kind !== "lucky" || treasure.kind !== "pick") throw new Error("kinds");
    expect(pocket.prizes.reduce((s, [, m, slots]) => s + m * slots, 0)).toBe(960000);
    expect(nine.outcomes.map(ninePays)).toEqual([1, 2, 2, 2, 3, 3, 5, 5, 9, 10, 10, 18, 25, 45, 100, 100, 900, 1000]);
    expect(nine.outcomes.reduce((s, row) => s + ninePays(row) * row[0], 0)).toBe(960000);
    expect(treasure.boards.reduce((s, [slots]) => s + slots, 0)).toBe(SLOTS);
    expect(treasure.boards.reduce((s, [slots, finds]) => s + slots * finds.reduce((a, f) => a + f, 0), 0)).toBe(2880000000);
  });

  it("wins 39.35%, 34.658%, and treasure pays its price or more 29,670,625 times in 84,000,000", () => {
    expect(TICKETS.map(winOdds)).toEqual([
      [393500, SLOTS],
      [346580, SLOTS],
      [29670625, 84000000],
    ]);
    expect(choose(9, 3)).toBe(84);
  });

  it("splits what three treasure spots pay: nothing, under the price, the price back, more", () => {
    const treasure = ticketOf("treasure");
    if (treasure.kind !== "pick") throw new Error("kind");
    const split = payoutSplit(treasure);
    expect(split).toEqual([21280625, 33048750, 16183750, 13486875]);
    expect(split.reduce((s, n) => s + n, 0)).toBe(84 * SLOTS);
    expect(split.map((n) => Math.round((n / (84 * SLOTS)) * 1000) / 10)).toEqual([25.3, 39.3, 19.3, 16.1]);
  });

  it("reads the win odds as one in n", () => {
    expect(TICKETS.map((t) => oneIn(...winOdds(t)))).toEqual(["2.5", "2.9", "2.8"]);
    expect(oneIn(125)).toBe("8,000");
  });

  it("prices the tickets, caps their top prizes, and sells treasure one at a time", () => {
    expect(TICKETS.map((t) => [t.id, t.price])).toEqual([["pocket", 10], ["nine", 100], ["treasure", 1000]]);
    expect(TICKETS.map(topPrize)).toEqual([1000, 100000, 300000]);
    expect(quantitiesOf(ticketOf("pocket"))).toEqual([1, 3, 5, 10]);
    expect(quantitiesOf(ticketOf("treasure"))).toEqual([1]);
    expect(isTicketId("nine")).toBe(true);
    expect(isTicketId("classic")).toBe(false);
  });

  it("formats K₽ the way Monetary does", () => {
    expect(kpText(1000000).replace(/\s/g, " ")).toBe("K₽ 1,000,000");
  });
});
