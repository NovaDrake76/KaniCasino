import { describe, it, expect, vi, afterEach } from "vitest";
import { markSeen, seenDraw } from "./lotterySeen";

describe("the draw a player has seen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("is kept per player under its own key, and starts at none", () => {
    expect(seenDraw("a")).toBe(0);
    markSeen("a", 3);
    expect(seenDraw("a")).toBe(3);
    expect(seenDraw("b")).toBe(0);
    expect(localStorage.getItem("lottery.seen.a")).toBe("3");
  });

  it("only moves forward", () => {
    markSeen("a", 5);
    markSeen("a", 4);
    expect(seenDraw("a")).toBe(5);
  });

  it("reads anything that is not a number as none", () => {
    localStorage.setItem("lottery.seen.a", "nope");
    expect(seenDraw("a")).toBe(0);
  });

  it("carries on when the browser refuses storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(seenDraw("a")).toBe(0);
    expect(() => markSeen("a", 2)).not.toThrow();
  });
});
