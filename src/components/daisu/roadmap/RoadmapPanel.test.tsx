import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import RoadmapPanel from "./RoadmapPanel";

const startDiscordOAuth = vi.fn(() => new Promise<string>(() => undefined));
vi.mock("../../../services/discord/DiscordLinkService", () => ({ startDiscordOAuth: () => startDiscordOAuth() }));
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

const chapterOne = (missions: RoadmapMission[]): Roadmap => ({
  chapter: 1,
  chapters: 5,
  finished: false,
  bonus: 1000,
  missions,
  next: {
    chapter: 2,
    bonus: 2000,
    missions: [
      { key: "r2-gift", goal: "giftSpins", target: 1, reward: 500 },
      { key: "r2-level", goal: "level", target: 10, reward: 1000 },
    ],
  },
});

const draw = (roadmap: Roadmap | null, helpKey: string | null = null) => {
  const onClaim = vi.fn();
  const onHelp = vi.fn();
  const onShowMe = vi.fn();
  render(
    <RoadmapPanel
      roadmap={roadmap}
      claimingMission={null}
      helpKey={helpKey}
      bonusGame={{ name: "Slots", art: "/images/slot/wild.webp" }}
      onClaim={onClaim}
      onHelp={onHelp}
      onShowMe={onShowMe}
    />
  );
  return { onClaim, onHelp, onShowMe };
};

describe("her missions tab", () => {
  it("shows the open chapter, what each mission asks, and the chapter after it locked", () => {
    draw(
      chapterOne([
        mission({ key: "r1-full-pot", claimed: true, complete: true, current: 1 }),
        mission({ key: "r1-pin", goal: "pinned", reward: 300, complete: true, claimable: true, current: 1 }),
        mission({ key: "r1-bonus", goal: "bonusSpent", reward: 300 }),
        mission({ key: "r1-level", goal: "level", target: 5, reward: 500, current: 3 }),
      ])
    );

    expect(screen.getByText("First steps")).toBeTruthy();
    expect(screen.getByText("2 of 4 done")).toBeTruthy();
    expect(screen.getByText(/right now that's slots/i)).toBeTruthy();
    expect(screen.getByText("3 / 5")).toBeTruthy();
    expect(screen.getByText("Claimed")).toBeTruthy();
    expect(screen.getByText(/chapter 2 · settling in/i)).toBeTruthy();
    expect(screen.getByText(/complete previous missions to unlock/i)).toBeTruthy();
    expect(screen.queryByText(/finish all four/i)).toBeNull();
    expect(screen.queryByText(/spin the daily gift/i)).toBeNull();
  });

  it("claims a finished mission and asks for help on one that is not", () => {
    const { onClaim, onHelp } = draw(
      chapterOne([
        mission({ key: "r1-pin", goal: "pinned", complete: true, claimable: true, current: 1 }),
        mission({ key: "r1-level", goal: "level", target: 5, current: 3 }),
      ])
    );

    fireEvent.click(screen.getByRole("button", { name: "Claim" }));
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(onClaim).toHaveBeenCalledWith("r1-pin");
    expect(onHelp).toHaveBeenCalledWith("r1-level");
  });

  it("unfolds her explanation under a mission whose help is open", () => {
    const { onShowMe } = draw(chapterOne([mission({ key: "r1-level", goal: "level", target: 5, current: 3 })]), "r1-level");

    expect(screen.getByText(/levels come from betting/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Got it" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    expect(onShowMe).toHaveBeenCalledWith("r1-level");
  });

  it("says so once every chapter is done", () => {
    draw({ chapter: 6, chapters: 5, finished: true, bonus: 0, missions: [], next: null });

    expect(screen.getByText(/you did everything i asked/i)).toBeTruthy();
  });
  // the mission names the server, so its row links and seats the player itself instead of pointing at settings
  it("links discord straight from the discord mission", () => {
    draw(chapterOne([mission({ key: "r3-discord", goal: "discordLinked", reward: 1000 })]));

    fireEvent.click(screen.getByRole("button", { name: /link discord/i }));

    expect(startDiscordOAuth).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /help/i })).toBeNull();
  });

  it("claims the discord mission like any other once it is done", () => {
    const { onClaim } = draw(chapterOne([mission({ key: "r3-discord", goal: "discordLinked", reward: 1000, current: 1, complete: true, claimable: true })]));

    fireEvent.click(screen.getByRole("button", { name: /^claim/i }));

    expect(onClaim).toHaveBeenCalledWith("r3-discord");
    expect(screen.queryByRole("button", { name: /link discord/i })).toBeNull();
  });
});
