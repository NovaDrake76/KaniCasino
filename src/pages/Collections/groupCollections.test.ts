import { describe, it, expect } from "vitest";
import { groupCollectionsByCategory, OTHER_CATEGORY } from "./groupCollections";
import { CollectionSummaryItem } from "../../services/collections/CollectionService";

const col = (
  caseId: string,
  category: string | undefined,
  owned: number,
  total: number
): CollectionSummaryItem => ({
  caseId,
  title: `case ${caseId}`,
  image: "",
  price: 10,
  category,
  slotsOwned: owned,
  slotsTotal: total,
  completionPct: total ? (owned / total) * 100 : 0,
  duplicatesValue: 0,
  duplicatesCount: 0,
  complete: total > 0 && owned === total,
});

describe("groupCollectionsByCategory", () => {
  it("groups by category and totals each shelf", () => {
    const groups = groupCollectionsByCategory([
      col("1", "Uma Musume", 3, 10),
      col("2", "Uma Musume", 5, 10),
      col("3", "Touhou", 1, 4),
    ]);
    const uma = groups.find((g) => g.category === "Uma Musume");
    expect(uma?.collections).toHaveLength(2);
    expect(uma?.slotsOwned).toBe(8);
    expect(uma?.slotsTotal).toBe(20);
  });

  it("counts completed collections per shelf", () => {
    const groups = groupCollectionsByCategory([
      col("1", "Touhou", 4, 4),
      col("2", "Touhou", 1, 4),
    ]);
    expect(groups[0].complete).toBe(1);
  });

  it("orders shelves by completion, most complete first", () => {
    const groups = groupCollectionsByCategory([
      col("1", "Animals", 1, 10),
      col("2", "Touhou", 9, 10),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Touhou", "Animals"]);
  });

  it("pins Counter-Strike last however complete it is", () => {
    const groups = groupCollectionsByCategory([
      col("1", "Counter-Strike", 10, 10),
      col("2", "Touhou", 1, 10),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Touhou", "Counter-Strike"]);
  });

  it("pools uncategorized collections into Other", () => {
    const groups = groupCollectionsByCategory([col("1", undefined, 1, 2), col("2", "  ", 1, 2)]);
    expect(groups.map((g) => g.category)).toEqual([OTHER_CATEGORY]);
    expect(groups[0].collections).toHaveLength(2);
  });

  it("handles an empty list", () => {
    expect(groupCollectionsByCategory([])).toEqual([]);
  });
});
