import { describe, it, expect } from "vitest";
import { resolveFilter, resolvePage, resolveSort } from "./CollectionDetail.services";

// these read straight off the query string, so anything can arrive here
describe("album view params", () => {
  it("falls back to the defaults when absent", () => {
    expect(resolveFilter(null)).toBe("all");
    expect(resolveSort(null)).toBe("mostRare");
    expect(resolvePage(null)).toBe(1);
  });

  it("keeps the real values", () => {
    expect(resolveFilter("duplicates")).toBe("duplicates");
    expect(resolveSort("mostCommon")).toBe("mostCommon");
    expect(resolvePage("3")).toBe(3);
  });

  it("rejects junk", () => {
    expect(resolveFilter("nonsense")).toBe("all");
    expect(resolveSort("cheapest")).toBe("mostRare");
    expect(resolvePage("nonsense")).toBe(1);
  });

  it("rejects pages that are not a whole number above zero", () => {
    expect(resolvePage("0")).toBe(1);
    expect(resolvePage("-5")).toBe(1);
    expect(resolvePage("2.5")).toBe(1);
    expect(resolvePage("")).toBe(1);
    expect(resolvePage("1e9")).toBe(1000000000);
  });
});
