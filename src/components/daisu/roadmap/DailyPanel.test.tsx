import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DailyPanel from "./DailyPanel";
import type { Daily, DailyMission } from "../../../services/daisu/RoadmapService";

vi.mock("../../../services/serverClock", () => ({ serverNow: () => Date.parse("2026-10-27T18:30:15Z") }));

const mission = (over: Partial<DailyMission>): DailyMission => ({
  key: "cases",
  goal: "casesOpened",
  game: null,
  target: 3,
  reward: 300,
  current: 0,
  complete: false,
  claimed: false,
  claimable: false,
  ...over,
});

const today: Daily = {
  day: "2026-10-27",
  resetsAt: "2026-10-28T00:00:00.000Z",
  missions: [
    mission({ key: "cases", current: 1 }),
    mission({ key: "crash", goal: "rounds", game: "crash", target: 5, reward: 500, current: 5, complete: true, claimable: true }),
    mission({ key: "stake", goal: "staked", target: 10000, reward: 750 }),
  ],
};

const draw = (helpKey: string | null = null) => {
  const onClaim = vi.fn();
  const onHelp = vi.fn();
  render(<DailyPanel daily={today} claimingMission={null} helpKey={helpKey} bonusGame={{ name: "Dice" }} onClaim={onClaim} onHelp={onHelp} />);
  return { onClaim, onHelp };
};

describe("her daily requests", () => {
  afterEach(() => vi.clearAllMocks());

  it("lists today's three with their progress and counts down to midnight utc", () => {
    draw();

    expect(screen.getByText("Open 3 cases")).toBeTruthy();
    expect(screen.getByText("Play 5 rounds of Crash")).toBeTruthy();
    expect(screen.getByText("Bet K₽ 10,000")).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();
    expect(screen.getByText("New ones in 5:29:45")).toBeTruthy();
  });

  it("claims a finished one by its own key, and opens help under a key no chapter mission uses", () => {
    const { onClaim, onHelp } = draw();

    fireEvent.click(screen.getByRole("button", { name: "Claim" }));
    fireEvent.click(screen.getAllByRole("button", { name: /help/i })[0]);

    expect(onClaim).toHaveBeenCalledWith("crash");
    expect(onHelp).toHaveBeenCalledWith("daily:cases");
  });

  it("shows her help only for the request it was opened on", () => {
    draw("daily:stake");

    expect(screen.getByText(/It adds up faster than you think/)).toBeTruthy();
    expect(screen.queryByText(/opening several at once/)).toBeNull();
  });
});
