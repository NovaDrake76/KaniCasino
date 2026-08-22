import { describe, expect, test } from "vitest";
import { autoStep } from "./autoRun";

const state = (over: Partial<Parameters<typeof autoStep>[0]> = {}) => ({
  left: 100,
  inFlight: 0,
  available: 1000,
  bet: 10,
  maxInFlight: 12,
  ...over,
});

describe("an auto run", () => {
  test("fires while there is room and money", () => {
    expect(autoStep(state())).toBe("fire");
  });

  test("ends when the count runs out", () => {
    expect(autoStep(state({ left: 0 }))).toBe("done");
  });

  test("waits instead of spending a ball when the board is full", () => {
    expect(autoStep(state({ inFlight: 12 }))).toBe("wait");
    expect(autoStep(state({ inFlight: 13 }))).toBe("wait");
  });

  test("waits out a shortfall that balls in the air may still cover", () => {
    expect(autoStep(state({ available: 0, inFlight: 3 }))).toBe("wait");
  });

  test("stops only once nothing is left to land", () => {
    expect(autoStep(state({ available: 0, inFlight: 0 }))).toBe("broke");
  });

  test("counts the board before the wallet, so a full board never reads as broke", () => {
    expect(autoStep(state({ available: 0, inFlight: 12 }))).toBe("wait");
  });
});
