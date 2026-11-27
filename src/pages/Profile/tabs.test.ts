import { describe, it, expect } from "vitest";
import { resolveSection, resolveTab } from "./tabs";

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
    expect(resolveTab("predictions", true)).toBe("predictions");
  });

  // isOwner is false both for a stranger and while /users/me is still in flight,
  // so this one case covers the leak and the race at once
  it("hides owner-only tabs from everyone else", () => {
    expect(resolveTab("missions", false)).toBe("inventory");
    expect(resolveTab("history", false)).toBe("inventory");
    expect(resolveTab("predictions", false)).toBe("inventory");
  });

  it("falls back to inventory on a junk tab", () => {
    expect(resolveTab("nonsense", true)).toBe("inventory");
  });

  // the gear opens it now, but old links and the discord redirect still ask for it by name
  it("still opens settings for the owner only", () => {
    expect(resolveTab("settings", true)).toBe("settings");
    expect(resolveTab("settings", false)).toBe("inventory");
  });
});

describe("resolveSection", () => {
  it("opens account when no section is asked for", () => {
    expect(resolveSection(null, false)).toBe("account");
  });

  it("opens the section the url names", () => {
    expect(resolveSection("account", false)).toBe("account");
    expect(resolveSection("preferences", false)).toBe("preferences");
    expect(resolveSection("discord", false)).toBe("discord");
    expect(resolveSection("email", false)).toBe("email");
  });

  it("falls back to account on a junk section", () => {
    expect(resolveSection("nonsense", false)).toBe("account");
  });

  // the oauth redirect carries no section, only its outcome
  it("opens discord when the link comes back from discord", () => {
    expect(resolveSection(null, true)).toBe("discord");
    expect(resolveSection("email", true)).toBe("discord");
  });
});
