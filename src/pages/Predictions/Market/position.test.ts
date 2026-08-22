import { describe, expect, test } from "vitest";
import { paidFor, profitOf } from "./position";

describe("what a sale cost", () => {
  test("the whole position carries everything spent on it", () => {
    expect(paidFor(367, 660, 660)).toBe(367);
  });

  test("a partial sale carries its slice", () => {
    expect(paidFor(367, 330, 660)).toBe(184);
    expect(paidFor(367, 1, 660)).toBe(1);
  });

  test("selling more than is held still only counts what is held", () => {
    expect(paidFor(367, 5000, 660)).toBe(367);
  });

  test("holding nothing costs nothing, and does not divide by zero", () => {
    expect(paidFor(0, 10, 0)).toBe(0);
    expect(paidFor(367, 10, 0)).toBe(0);
  });
});

describe("what a sale makes", () => {
  // the real position that prompted this: 660 shares bought around 55%, quoted at 95.7%
  test("reads a gain as a gain", () => {
    expect(profitOf(631, 367)).toEqual({ profit: 264, pct: 72 });
  });

  test("reads a loss as a loss", () => {
    expect(profitOf(300, 367)).toEqual({ profit: -67, pct: -18 });
  });

  test("is blank until there is a quote", () => {
    expect(profitOf(null, 367)).toBeNull();
  });

  test("does not divide by a cost of zero", () => {
    expect(profitOf(50, 0)).toEqual({ profit: 50, pct: 0 });
  });
});
