import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import UserContext from "../../UserContext";
import Slots from "./Slot";

let answer: (value: unknown) => void = () => undefined;
vi.mock("../../services/games/GamesServices", () => ({
  spinSlots: () => new Promise((resolve) => (answer = resolve)),
}));
vi.mock("../../services/sound/sound", () => ({ play: vi.fn() }));
vi.mock("../../components/game/GameDetails", () => ({ default: () => null }));
vi.mock("../../components/LiveStats/LiveStatsButton", () => ({ default: () => null }));
vi.mock("../../components/daisu/GameBonus", () => ({ GameBonusStrip: () => null, BonusBetHint: () => null }));

const GRID = ["wild", "red", "blue", "hakkero", "green", "yellow", "yin_yang", "red", "wild"];

describe("a slots spin", () => {
  // started on the click, a slow answer landed while the reels turned and the symbols changed mid-spin
  it("leaves the reels still until the result is in, then spins them onto it", async () => {
    const { container } = render(
      <UserContext.Provider value={{ userData: { id: "u1", walletBalance: 1000 }, toogleUserFlow: vi.fn() } as never}>
        <Slots />
      </UserContext.Provider>
    );
    const button = container.querySelector('[data-tour="play-button"]') as HTMLButtonElement;
    const reels = () => Array.from(container.querySelectorAll(".overflow-hidden > div")) as HTMLDivElement[];
    expect(reels()).toHaveLength(3);

    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(reels().map((r) => r.style.animation)).toEqual(["", "", ""]);

    await act(async () => answer({ gridState: GRID, lastSpinResult: [], totalPayout: 0 }));
    expect(reels().every((r) => /spin/.test(r.style.animation))).toBe(true);
    const first = Array.from(reels()[0].querySelectorAll("img")).map((img) => img.getAttribute("alt"));
    expect(first.slice(-3)).toEqual([GRID[0], GRID[3], GRID[6]]);
    expect(button.disabled).toBe(true);
  });
});
