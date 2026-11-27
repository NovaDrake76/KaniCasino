import { describe, it, expect, vi, afterEach } from "vitest";
import { readSkip, writeSkip } from "./skipAnimation";

describe("the skip animation preference", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("is off until this browser turns it on, and remembers either choice", () => {
    expect(readSkip()).toBe(false);

    writeSkip(true);
    expect(localStorage.getItem("kani.skipCaseAnimation")).toBe("1");
    expect(readSkip()).toBe(true);

    writeSkip(false);
    expect(readSkip()).toBe(false);
  });

  it("stays off, and never throws, when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => writeSkip(true)).not.toThrow();
    expect(readSkip()).toBe(false);
  });
});
