import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import NextUp from "./NextUp";
import type { Roadmap, RoadmapMission } from "../../../services/daisu/RoadmapService";

const mission = (over: Partial<RoadmapMission>): RoadmapMission => ({
  key: "r1-full-pot",
  goal: "fullPots",
  target: 1,
  reward: 250,
  current: 0,
  complete: false,
  claimed: false,
  claimable: false,
  ...over,
});

const roadmap = (missions: RoadmapMission[]): Roadmap => ({ chapter: 1, chapters: 5, finished: false, bonus: 1000, missions, next: null });

const draw = (r: Roadmap | null) => {
  const handlers = { onClaim: vi.fn(), onHelp: vi.fn(), onAll: vi.fn() };
  const view = render(<NextUp roadmap={r} claimingMission={null} bonusGame={{ name: "Dice" }} {...handlers} />);
  return { ...handlers, view };
};

describe("next up on her card", () => {
  it("shows the first mission still to do, with its progress and a way to ask for help", () => {
    const { onHelp, onAll } = draw(
      roadmap([
        mission({ key: "r1-full-pot", complete: true, claimed: true, current: 1 }),
        mission({ key: "r1-level", goal: "level", target: 5, reward: 500, current: 3 }),
      ])
    );

    expect(screen.getByText("Reach level 5")).toBeTruthy();
    expect(screen.getByText("Chapter 1 · 1 of 2 done")).toBeTruthy();
    expect(screen.getByText("3 / 5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(screen.getByRole("button", { name: "All missions" }));

    expect(onHelp).toHaveBeenCalledWith("r1-level");
    expect(onAll).toHaveBeenCalled();
  });

  it("puts a reward waiting one click away", () => {
    const { onClaim } = draw(
      roadmap([
        mission({ key: "r1-pin", goal: "pinned", reward: 300, complete: true, claimable: true, current: 1 }),
        mission({ key: "r1-level", goal: "level", target: 5 }),
      ])
    );

    fireEvent.click(screen.getByRole("button", { name: /rewards waiting: 1/i }));

    expect(onClaim).toHaveBeenCalledWith("r1-pin");
  });

  it("stays off her card when there is nothing to show", () => {
    const { view } = draw(null);

    expect(view.container).toBeEmptyDOMElement();
  });
});
