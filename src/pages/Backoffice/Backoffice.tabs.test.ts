import { describe, it, expect } from "vitest";
import { parseAdminUrl, writeAdminUrl, AdminUrlState } from "./Backoffice.tabs";

const parse = (qs: string) => parseAdminUrl(new URLSearchParams(qs));
const write = (over: Partial<AdminUrlState> = {}) =>
  writeAdminUrl({ tab: "overview", days: null, page: 1, search: "", playerId: null, ...over }).toString();

describe("the backoffice url", () => {
  it("opens on the overview with nothing set", () => {
    expect(parse("")).toEqual({ tab: "overview", days: null, page: 1, search: "", playerId: null });
  });

  it("survives a reload with everything set", () => {
    // the whole point: state lived in react only, so leaving the page and coming back
    // dropped you at the default view with the search box empty
    expect(parse("tab=players&days=30&q=nova&page=3")).toEqual({
      tab: "players", days: 30, page: 3, search: "nova", playerId: null,
    });
  });

  it("round trips", () => {
    const state: AdminUrlState = { tab: "cases", days: 7, page: 2, search: "kani", playerId: null };
    expect(parse(writeAdminUrl(state).toString())).toEqual(state);
  });

  it("writes only what differs from the default, so a shared link is short", () => {
    expect(write()).toBe("");
    expect(write({ tab: "games" })).toBe("tab=games");
    expect(write({ days: 7 })).toBe("days=7");
  });

  it("puts a player link on the players tab whatever the tab says", () => {
    // otherwise the row that opened the drill-down sits behind a tab you are not looking at
    expect(parse("player=abc123&tab=cases").tab).toBe("players");
    expect(parse("player=abc123").playerId).toBe("abc123");
  });

  it("refuses a tab that does not exist rather than rendering nothing", () => {
    expect(parse("tab=nonsense").tab).toBe("overview");
  });

  it("refuses a nonsense window or page", () => {
    expect(parse("days=99").days).toBe(null);
    expect(parse("days=abc").days).toBe(null);
    expect(parse("page=0").page).toBe(1);
    expect(parse("page=-5").page).toBe(1);
    expect(parse("page=abc").page).toBe(1);
  });

  it("keeps the two windows the toggle offers", () => {
    expect(parse("days=7").days).toBe(7);
    expect(parse("days=30").days).toBe(30);
  });
});
