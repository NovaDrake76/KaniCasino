import { describe, it, expect } from "vitest";
import { groupCasesByCategory, OTHER_CATEGORY } from "./groupCases";

// objectid-like ids where string order is creation order
const c = (_id: string, category?: string, price = 0) => ({ _id, title: `case ${_id}`, category, price });

describe("groupCasesByCategory", () => {
  it("groups by category with the cheapest case first inside each group", () => {
    const groups = groupCasesByCategory([
      c("1", "Touhou", 8000),
      c("3", "Touhou", 60),
      c("2", "Animals", 40),
    ]);
    const touhou = groups.find((g) => g.category === "Touhou");
    expect(touhou?.cases.map((x: any) => x._id)).toEqual(["3", "1"]);
  });

  it("puts a premium case behind every cheaper one even though it is the newest", () => {
    const groups = groupCasesByCategory([
      c("9", "Blue Archive", 10000),
      c("1", "Blue Archive", 45),
      c("2", "Blue Archive", 30),
    ]);
    expect(groups[0].cases.map((x: any) => [x._id, x.price])).toEqual([
      ["2", 30],
      ["1", 45],
      ["9", 10000],
    ]);
  });

  it("breaks a price tie with the newest case", () => {
    const groups = groupCasesByCategory([c("1", "Touhou", 60), c("3", "Touhou", 60)]);
    expect(groups[0].cases.map((x: any) => x._id)).toEqual(["3", "1"]);
  });

  it("still orders groups by their newest case, not their cheapest", () => {
    const groups = groupCasesByCategory([
      c("1", "Touhou", 10),
      c("5", "Animals", 9000),
      c("2", "Animals", 20),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Animals", "Touhou"]);
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

  it("gives every group a slug the category bar can scroll to", () => {
    const groups = groupCasesByCategory([c("1", "Blue Archive"), c("2", "Touhou"), c("3")]);
    expect(groups.map((g) => g.id)).toEqual(["cases-touhou", "cases-blue-archive", "cases-other"]);
  });

  it("keeps ids unique when two category names slug the same way", () => {
    const groups = groupCasesByCategory([c("1", "Re:Zero"), c("2", "Re Zero")]);
    expect(new Set(groups.map((g) => g.id)).size).toBe(2);
    expect(groups.map((g) => g.id)).toContain("cases-re-zero");
  });

  it("still produces an anchor for a category with nothing sluggable in it", () => {
    const groups = groupCasesByCategory([c("1", "★")]);
    expect(groups[0].id).toBe("cases-group");
  });
});
