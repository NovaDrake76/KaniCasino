import { describe, expect, test } from "vitest";
import { autoStep, outcomeFor } from "./autoRun";

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

  test("ends when the count runs out and the board is clear", () => {
    expect(autoStep(state({ left: 0 }))).toBe("done");
  });

  test("does not call it done while a ball may still need another try", () => {
    expect(autoStep(state({ left: 0, inFlight: 2 }))).toBe("wait");
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

describe("a refused drop", () => {
  test("is retryable when the server says it lost a race or is rate limiting", () => {
    expect(outcomeFor(503)).toBe("retry");
    expect(outcomeFor(429)).toBe("retry");
  });

  test("ends the run when the refusal is the player's to fix", () => {
    expect(outcomeFor(400)).toBe("stop");
    expect(outcomeFor(401)).toBe("stop");
    expect(outcomeFor(500)).toBe("stop");
    expect(outcomeFor(undefined)).toBe("stop");
  });
});
