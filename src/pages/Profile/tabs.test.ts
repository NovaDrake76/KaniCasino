import { describe, it, expect } from "vitest";
import { resolveTab } from "./tabs";

describe("resolveTab", () => {
  it("defaults to inventory when no tab is asked for", () => {
    expect(resolveTab(null, true)).toBe("inventory");
    expect(resolveTab(null, false)).toBe("inventory");
  });

  it("opens collections for anyone", () => {
    expect(resolveTab("collections", false)).toBe("collections");
    expect(resolveTab("collections", true)).toBe("collections");
  });

  it("gives the owner their own tabs", () => {
    expect(resolveTab("missions", true)).toBe("missions");
    expect(resolveTab("history", true)).toBe("history");
  });

  // isOwner is false both for a stranger and while /users/me is still in flight,
  // so this one case covers the leak and the race at once
  it("hides owner-only tabs from everyone else", () => {
    expect(resolveTab("missions", false)).toBe("inventory");
    expect(resolveTab("history", false)).toBe("inventory");
  });

  it("falls back to inventory on a junk tab", () => {
    expect(resolveTab("nonsense", true)).toBe("inventory");
  });
});
