import { describe, it, expect } from "vitest";
import { isCurrent } from "./navActive";

describe("which navbar entry is the current page", () => {
  it("lights the entry whose page is open", () => {
    expect(isCurrent("/marketplace", "", "/marketplace")).toBe(true);
    expect(isCurrent("/marketplace/item/1", "", "/marketplace")).toBe(true);
  });

  it("leaves the others dark", () => {
    expect(isCurrent("/crash", "", "/marketplace")).toBe(false);
  });

  // "/gifted" is not the daily gift, and a prefix test alone would light it
  it("matches whole path segments, not prefixes", () => {
    expect(isCurrent("/gifted", "", "/gift")).toBe(false);
    expect(isCurrent("/predictions-old", "", "/predictions")).toBe(false);
  });

  it("only lights home on home", () => {
    expect(isCurrent("/", "", "/")).toBe(true);
    expect(isCurrent("/crash", "", "/")).toBe(false);
  });

  it("needs the tab to match when the link carries one", () => {
    const missions = "/profile/abc?tab=missions";
    expect(isCurrent("/profile/abc", "?tab=missions", missions)).toBe(true);
    expect(isCurrent("/profile/abc", "?tab=inventory", missions)).toBe(false);
    expect(isCurrent("/profile/abc", "", missions)).toBe(false);
    expect(isCurrent("/profile/other", "?tab=missions", missions)).toBe(false);
  });
});
