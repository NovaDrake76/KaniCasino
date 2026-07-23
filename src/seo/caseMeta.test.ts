import { describe, it, expect } from "vitest";
import { caseMeta, casePhrase } from "./caseMeta";
import routes from "./routes.json";

describe("casePhrase", () => {
  it("gives each category its own wording", () => {
    expect(casePhrase("Counter-Strike")).toBe("CS2 Case Simulator");
    expect(casePhrase("Touhou")).toBe("Touhou Casino");
    expect(casePhrase("Blue Archive")).toBe("Blue Archive Gacha Simulator");
    expect(casePhrase("Uma Musume")).toBe("Uma Musume Gacha Simulator");
  });

  it("falls back for an unknown, empty or missing category", () => {
    expect(casePhrase("Nothing")).toBe(routes.defaultCategoryPhrase);
    expect(casePhrase("")).toBe(routes.defaultCategoryPhrase);
    expect(casePhrase(undefined)).toBe(routes.defaultCategoryPhrase);
  });

  it("tolerates the padding the backend allows on category", () => {
    expect(casePhrase("  Touhou  ")).toBe("Touhou Casino");
  });
});

describe("caseMeta", () => {
  it("names the case and its category", () => {
    const m = caseMeta({ title: "Recoil Case", price: 25, category: "Counter-Strike" });
    expect(m.title).toBe("Recoil Case | CS2 Case Simulator | KaniCasino");
    expect(m.description).toContain("Recoil Case");
    expect(m.description).toContain("K₽25");
    expect(m.description).toContain("CS2 Case Simulator");
  });

  it("uses the right wording for a non-counter-strike case", () => {
    expect(caseMeta({ title: "Lunatic Case", price: 60, category: "Touhou" }).title).toBe(
      "Lunatic Case | Touhou Casino | KaniCasino"
    );
  });

  it("leaves no placeholder unfilled", () => {
    const m = caseMeta({ title: "Kivotos Case", price: 30, category: "Blue Archive" });
    expect(m.title).not.toMatch(/[{}]/);
    expect(m.description).not.toMatch(/[{}]/);
  });

  it("survives a case with no price", () => {
    const m = caseMeta({ title: "Odd Case", price: undefined as unknown as number });
    expect(m.description).toContain("K₽0");
    expect(m.title).toBe("Odd Case | Case Simulator | KaniCasino");
  });

  it("covers every category that has cases in the database", () => {
    // the live set as of 2026-07-23; a new theme should get its own wording, not the default
    for (const c of ["Counter-Strike", "Uma Musume", "Blue Archive", "Touhou", "Animals"]) {
      expect(Object.keys(routes.categories)).toContain(c);
    }
  });
});
