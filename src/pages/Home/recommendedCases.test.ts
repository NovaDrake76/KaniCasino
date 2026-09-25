import { describe, it, expect } from "vitest";
import { recommendedCases } from "./recommendedCases";
import { isNewCase } from "../../utils/caseAge";

const DAY = 86400000;
const ADDED = Date.UTC(2026, 8, 24);

// an objectid carries its creation time in its first eight hex digits
const idAt = (at: number, n: number) => Math.floor(at / 1000).toString(16).padStart(8, "0") + String(n).padStart(16, "0");
const c = (_id: string) => ({ _id, title: `case ${_id}` });

const fresh = [c(idAt(ADDED, 1)), c(idAt(ADDED, 2))];
const pinned = fresh.map((x) => x._id);
const opened = [1, 2, 3, 4, 5].map((n) => c(idAt(ADDED - 300 * DAY, 10 + n)));
const catalog = [...opened, ...fresh];

describe("recommendedCases", () => {
  it("puts the pinned cases first while they are new, then the most opened, five in all", () => {
    const row = recommendedCases(catalog, opened, pinned, ADDED + 3 * DAY);
    expect(row.map((x) => x._id)).toEqual([...pinned, ...opened.slice(0, 3).map((x) => x._id)]);
  });

  it("drops the pins once they are a month old, leaving the most opened", () => {
    const row = recommendedCases(catalog, opened, pinned, ADDED + 31 * DAY);
    expect(row.map((x) => x._id)).toEqual(opened.map((x) => x._id));
  });

  it("does not show a pinned case twice when it is also among the most opened", () => {
    const row = recommendedCases(catalog, [fresh[1], ...opened], pinned, ADDED + DAY);
    expect(row.map((x) => x._id)).toEqual([...pinned, ...opened.slice(0, 3).map((x) => x._id)]);
  });

  it("skips a pinned case the catalogue no longer has", () => {
    const row = recommendedCases(opened, opened, pinned, ADDED + DAY);
    expect(row.map((x) => x._id)).toEqual(opened.map((x) => x._id));
  });

  it("copes with the catalogue not having loaded", () => {
    expect(recommendedCases(undefined as never, opened, pinned, ADDED).length).toBe(5);
  });
});

describe("isNewCase", () => {
  it("is new for thirty days after the case was added", () => {
    const id = idAt(ADDED, 1);
    expect(isNewCase(id, ADDED + 29 * DAY)).toBe(true);
    expect(isNewCase(id, ADDED + 30 * DAY)).toBe(false);
  });

  it("is never new for an id that is not an objectid", () => {
    expect(isNewCase("case9", ADDED)).toBe(false);
  });
});
