import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GameDetails from "./index";
import { gameInfo, GameKey } from "./content";

vi.mock("../LiveBets", () => ({ default: () => <div data-testid="live-feed" /> }));

const draw = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);
const GAMES: GameKey[] = ["crash", "coinflip", "slots", "upgrade", "battles", "plinko", "blackjack", "dice", "mines", "hilo"];

describe("the strip under a game", () => {
  it("opens on the live bets and switches to the game info", () => {
    draw(<GameDetails game="dice" />);
    expect(screen.getByTestId("live-feed")).toBeTruthy();
    expect(screen.queryByTestId("game-info")).toBeNull();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    fireEvent.click(tabs[1]);
    expect(screen.getByTestId("game-info")).toBeTruthy();
    expect(screen.queryByTestId("live-feed")).toBeNull();
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  });

  it("shows a live game's round instead of the feed", () => {
    draw(<GameDetails game="crash" roundBets={<div data-testid="round" />} roundSummary={<span data-testid="summary" />} />);
    expect(screen.getByTestId("round")).toBeTruthy();
    expect(screen.getByTestId("summary")).toBeTruthy();
    expect(screen.queryByTestId("live-feed")).toBeNull();
  });

  it("shows only the game info for a game the feed does not cover", () => {
    draw(<GameDetails game="upgrade" feed={false} />);
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByTestId("game-info")).toBeTruthy();
  });

  // every game has text in every slot the panel reads, so a missing key cannot show as a raw path
  it("has a name, a summary, three steps and facts for every game", () => {
    for (const game of GAMES) {
      const info = gameInfo(game, { purpleOn: true, side: 2, purple: 32, purpleChance: 3 });
      expect(info.name).not.toMatch(/\./);
      expect(info.summary).not.toMatch(/^gameInfo\./);
      expect(info.sections[0].steps).toHaveLength(3);
      expect(info.facts.length).toBeGreaterThan(2);
      for (const section of info.sections) {
        for (const text of [...(section.steps || []), ...(section.paragraphs || []), ...(section.bullets || [])]) {
          expect(text).not.toMatch(/gameInfo\.|\{\{/);
        }
      }
    }
  });

  it("quotes the coin's live payouts", () => {
    const info = gameInfo("coinflip", { purpleOn: true, side: 2, purple: 32, purpleChance: 3 });
    expect(info.sections[1].paragraphs?.[0]).toContain("48.5");
    expect(info.facts.map((f) => f.value)).toEqual(expect.arrayContaining(["97%", "96%"]));
  });
});
