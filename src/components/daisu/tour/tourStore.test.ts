import { describe, it, expect, vi, beforeEach } from "vitest";
import { endTour, finishTour, goTo, startTour, syncTour, tourState } from "./tourStore";

const saveTour = vi.fn();
vi.mock("../../../services/daisu/DaisuService", () => ({
  saveTour: (...args: unknown[]) => saveTour(...args),
}));

type Onboarding = { status: "offered" | "active" | "skipped" | "done"; step: string | null } | null;

let accounts = 0;
// the store outlives any one test, so each test signs in as an account of its own
const signIn = (onboarding: Onboarding) => {
  accounts += 1;
  syncTour(`account-${accounts}`, onboarding);
};
const saved = () => saveTour.mock.calls.map((call) => call.filter((arg) => arg !== undefined));

describe("the tour's record", () => {
  beforeEach(() => {
    saveTour.mockReset().mockResolvedValue(undefined);
  });

  it("takes the server's word once per account, then trusts this tab", () => {
    signIn({ status: "offered", step: null });
    startTour();
    syncTour(tourState().owner, { status: "offered", step: null });

    expect(tourState()).toMatchObject({ status: "active", step: "pot" });
  });

  it("starts at the pot and saves every step, the last one as done", () => {
    signIn({ status: "offered", step: null });
    startTour();
    goTo("case");
    goTo("done");

    expect(saved()).toEqual([["active", "pot"], ["active", "case"], ["done", "done"]]);
  });

  it("saves a skip while the tour runs, and nothing for a tour already over", () => {
    signIn({ status: "active", step: "game" });
    endTour();
    expect(saved()).toEqual([["skipped"]]);

    signIn({ status: "done", step: "done" });
    endTour();
    expect(saved()).toEqual([["skipped"]]);
  });

  it("closes the last card without saving again", () => {
    signIn({ status: "active", step: "done" });
    finishTour();

    expect(tourState().status).toBe("done");
    expect(saveTour).not.toHaveBeenCalled();
  });

  it("carries on in this tab when a save does not land", async () => {
    saveTour.mockRejectedValue(new Error("offline"));
    signIn({ status: "offered", step: null });
    startTour();
    await Promise.resolve();

    expect(tourState()).toMatchObject({ status: "active", step: "pot" });
  });
});
