import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PotChip from "./index";
import HomeFeed from "../HomeFeed";
import GameListing from "../GamesListing";

const getLotteryPot = vi.fn();
vi.mock("../../../services/lottery/LotteryService", () => ({ getLotteryPot: () => getLotteryPot() }));
// the feed also polls the board for the strip and the leaderboard; the chip never reads it
vi.mock("../../../services/leaderboard/LeaderboardService", () => ({ getBoard: () => new Promise(() => undefined) }));

// the app's socket: handlers registered by the feed, fired by the test as the server would
const handlers = new Map<string, (payload: unknown) => void>();
vi.mock("../../../services/socket", () => ({
  default: {
    getInstance: () => ({
      on: (event: string, fn: (payload: unknown) => void) => handlers.set(event, fn),
      off: (event: string) => handlers.delete(event),
    }),
  },
}));

const POT = { number: 7, jackpot: 61300, drawAt: "2026-11-15T20:00:00.000Z", serverTime: "2026-11-15T12:00:00.000Z" };
const text = () => (screen.queryByTestId("lottery-pot")?.textContent || "").replace(/\s/g, " ");

const show = async (ui: React.ReactNode = <PotChip />) => {
  render(<HomeFeed>{ui}</HomeFeed>);
  await act(() => Promise.resolve());
};

describe("the jackpot on the lottery tile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    getLotteryPot.mockResolvedValue(POT);
  });

  it("reads the open draw's pot once when the home page opens", async () => {
    await show();
    expect(getLotteryPot).toHaveBeenCalledTimes(1);
    expect(text()).toBe("Jackpot K₽ 61,300");
  });

  it("moves with every ticket sold in that draw and ignores any other", async () => {
    await show();
    act(() => handlers.get("lottery:pot")?.({ draw: 7, jackpot: 61325, tickets: 900 }));
    expect(text()).toBe("Jackpot K₽ 61,325");
    act(() => handlers.get("lottery:pot")?.({ draw: 6, jackpot: 99999, tickets: 1 }));
    expect(text()).toBe("Jackpot K₽ 61,325");
  });

  it("moves on to the next draw's pot once a draw is settled", async () => {
    await show();
    act(() => handlers.get("lottery:drawn")?.({ number: 7, numbers: [1, 2, 3], jackpot: 61325, next: { number: 8, jackpot: 25000, drawAt: "2026-11-16T20:00:00.000Z" } }));
    expect(text()).toBe("Jackpot K₽ 25,000");
    act(() => handlers.get("lottery:drawn")?.({ number: 8, numbers: [1, 2, 3], jackpot: 25000, next: null }));
    expect(text()).toBe("Jackpot K₽ 25,000");
  });

  it("shows no chip when the read fails or there is no open draw", async () => {
    getLotteryPot.mockRejectedValue(new Error("offline"));
    await show();
    expect(screen.queryByTestId("lottery-pot")).toBeNull();
    act(() => handlers.get("lottery:pot")?.({ draw: 7, jackpot: 61325, tickets: 900 }));
    expect(screen.queryByTestId("lottery-pot")).toBeNull();
  });

  it("shows no chip for an empty answer", async () => {
    getLotteryPot.mockResolvedValue(null);
    await show();
    expect(screen.queryByTestId("lottery-pot")).toBeNull();
  });

  it("asks nothing by itself outside the home page's feed", async () => {
    render(<PotChip />);
    await act(() => Promise.resolve());
    expect(getLotteryPot).not.toHaveBeenCalled();
    expect(screen.queryByTestId("lottery-pot")).toBeNull();
  });

  it("sits on the lottery tile of the games listing, and only there", async () => {
    await show(
      <MemoryRouter>
        <GameListing name="Our Games" />
      </MemoryRouter>
    );
    const tile = screen.getByRole("link", { name: /Daily Lottery/ });
    expect(tile.getAttribute("href")).toBe("/lottery");
    expect(within(tile).getByTestId("lottery-pot").textContent?.replace(/\s/g, " ")).toBe("Jackpot K₽ 61,300");
    expect(screen.getAllByTestId("lottery-pot")).toHaveLength(1);
  });
});
