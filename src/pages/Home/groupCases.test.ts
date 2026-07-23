import { describe, it, expect } from "vitest";
import { groupCasesByCategory, OTHER_CATEGORY } from "./groupCases";

// objectid-like ids where string order is creation order
const c = (_id: string, category?: string) => ({ _id, title: `case ${_id}`, category });

describe("groupCasesByCategory", () => {
  it("groups by category with the newest case first inside each group", () => {
    const groups = groupCasesByCategory([c("1", "Touhou"), c("3", "Touhou"), c("2", "Animals")]);
    const touhou = groups.find((g) => g.category === "Touhou");
    expect(touhou?.cases.map((x: any) => x._id)).toEqual(["3", "1"]);
  });

  it("orders groups by their newest case, newest group first", () => {
    const groups = groupCasesByCategory([c("1", "Touhou"), c("2", "Animals"), c("3", "Touhou")]);
    expect(groups.map((g) => g.category)).toEqual(["Touhou", "Animals"]);
  });

  it("pools uncategorized cases into Other, pinned last", () => {
    const groups = groupCasesByCategory([c("9"), c("1", "Touhou"), c("8", "  ")]);
    expect(groups.map((g) => g.category)).toEqual(["Touhou", OTHER_CATEGORY]);
    expect(groups[1].cases).toHaveLength(2);
  });

  it("pins Counter-Strike last even though it is the newest set", () => {
    const groups = groupCasesByCategory([c("9", "Counter-Strike"), c("1", "Touhou"), c("2", "Animals")]);
    expect(groups.map((g) => g.category)).toEqual(["Animals", "Touhou", "Counter-Strike"]);
  });

  it("keeps Other ahead of Counter-Strike when both are present", () => {
    const groups = groupCasesByCategory([c("9", "Counter-Strike"), c("8"), c("1", "Touhou")]);
    expect(groups.map((g) => g.category)).toEqual(["Touhou", OTHER_CATEGORY, "Counter-Strike"]);
  });

  it("handles an empty list", () => {
    expect(groupCasesByCategory([])).toEqual([]);
  });
});
