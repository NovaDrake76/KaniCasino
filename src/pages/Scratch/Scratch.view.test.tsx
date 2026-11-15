import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserContext from "../../UserContext";
import Scratch from "./index";
import { WIPE_MS } from "./Scratch.services";

const buyScratch = vi.fn();
const pickScratch = vi.fn();
const getActiveScratch = vi.fn();
vi.mock("../../services/games/GamesServices", () => ({
  buyScratch: (...args: unknown[]) => buyScratch(...args),
  pickScratch: (...args: unknown[]) => pickScratch(...args),
  getActiveScratch: (...args: unknown[]) => getActiveScratch(...args),
}));
vi.mock("../../stats/SessionStatsContext", () => ({ useSessionStats: () => ({ track: () => undefined }) }));
vi.mock("../../services/sound/sound", () => ({ play: () => undefined }));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../../components/game/GameDetails", () => ({ default: () => null }));
vi.mock("../../components/LiveStats/LiveStatsButton", () => ({ default: () => null }));
vi.mock("../../components/daisu/GameBonus", () => ({ GameBonusStrip: () => null, BonusBetHint: () => null }));
vi.mock("../Slot/BigWinAlert", () => ({ default: ({ value }: { value: number }) => <div data-testid="big-win">{value}</div> }));
// the canvas has no 2d context under jsdom; a stand-in plays the player's part: pressing it is a stroke start, a double
// click is the foil worn through
vi.mock("./ScratchCoating", () => ({
  default: ({ active, testId, onStart, onComplete }: { active: boolean; testId?: string; onStart?: () => boolean; onComplete: () => void }) => (
    <button data-testid={testId || "scratch-coating"} disabled={!active} onClick={() => onStart?.()} onDoubleClick={onComplete}>
      foil
    </button>
  ),
}));

const pocket = {
  ticket: "pocket",
  price: 10,
  quantity: 1,
  tickets: [
    {
      symbol: "coins",
      multiplier: 5,
      payout: 50,
      cells: ["coins", "star", "chest", "clover", "coins", "star", "gem", "clover", "coins"],
      line: [0, 4, 8],
      winningCells: [0, 4, 8],
      rollId: "R123456789",
    },
  ],
  totalPayout: 50,
  balanceAfterCharge: 990,
  balance: 1040,
};

const treasure = {
  ticket: "treasure",
  price: 1000,
  quantity: 1,
  game: { id: "SC000000123", ticket: "treasure", price: 1000, status: "active", picks: [], left: 3, board: null, payout: 0, rollId: null },
  balanceAfterCharge: 4000,
  balance: 4000,
};

const draw = (userData: unknown = { id: "u1", walletBalance: 5000 }) =>
  render(
    <UserContext.Provider value={{ userData, toogleUserData: vi.fn(), toogleUserFlow: vi.fn() } as never}>
      <MemoryRouter>
        <Scratch />
      </MemoryRouter>
    </UserContext.Provider>
  );

const text = (el: Element | null) => (el?.textContent || "").replace(/\s/g, " ");

describe("the scratch page view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveScratch.mockResolvedValue({ game: null });
  });
  afterEach(() => vi.useRealTimers());

  it("lays out the catalogue, one card per ticket, and the panel for the one selected", async () => {
    await act(async () => {
      draw();
    });
    const rack = screen.getByTestId("scratch-catalogue");
    expect(within(rack).getAllByRole("button")).toHaveLength(3);
    for (const name of ["Pocket Change", "Perfect Nine", "Borrowed Treasure"]) expect(within(rack).getByText(name)).toBeTruthy();
    expect(screen.getByTestId("ticket-card-pocket").getAttribute("aria-pressed")).toBe("true");
    const treasureCard = screen.getByTestId("ticket-card-treasure");
    expect(text(treasureCard)).not.toMatch(/1 in/);
    expect(text(screen.getByTestId("ticket-card-nine"))).not.toMatch(/1 in/);
    expect(text(within(treasureCard).getByTestId("card-top"))).toBe("K₽ 300,000");
    expect(text(within(treasureCard).getByTestId("card-price"))).toBe("K₽ 1,000");
    expect(text(screen.getByTestId("ticket-details"))).toContain("Match 3 in a line to win.");
    expect(screen.getByRole("button", { name: "10" })).toBeTruthy();

    fireEvent.click(screen.getByTestId("ticket-card-treasure"));
    expect(screen.getByTestId("ticket-card-treasure").getAttribute("aria-pressed")).toBe("true");
    expect(text(screen.getByTestId("ticket-details"))).toContain("Scratch 3 only.");
    expect(screen.getByTestId("prize-key").querySelectorAll("img")).toHaveLength(5);
    // the count row and the other tickets' details stay laid out, hidden, so the panel keeps its height
    expect(screen.queryByRole("button", { name: "10" })).toBeNull();
    expect(screen.getByRole("button", { name: "1", hidden: true }).closest("[aria-hidden]")).toBeTruthy();
    expect(screen.getAllByText("Pocket Change").some((el) => el.closest("[aria-hidden]"))).toBe(true);
    expect(text(screen.getByRole("button", { name: /^Buy 1 for/ }))).toBe("Buy 1 for K₽ 1,000");
  });

  it("buys a pocket ticket, wipes it with reveal all, and offers to buy again or go back", async () => {
    vi.useFakeTimers();
    buyScratch.mockResolvedValue(pocket);
    await act(async () => {
      draw();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Buy 1 for/ }));
    });
    expect(buyScratch).toHaveBeenCalledWith("pocket", 1);
    expect(screen.queryByTestId("scratch-catalogue")).toBeNull();
    const ticket = screen.getByTestId("scratch-ticket");
    expect(text(ticket)).toContain("Series 001");
    expect(text(ticket)).toContain("Match 3 in a line to win.");
    expect(screen.getAllByTestId("scratch-cell")).toHaveLength(9);
    expect(screen.queryByTestId("ticket-details")).toBeNull();
    expect(screen.queryByTestId("prize-key")).toBeNull();
    expect(text(screen.getByTestId("ticket-progress"))).not.toContain("Match 3 in a line");
    // the result line is empty and the finished row is laid out unseen until the ticket is done
    expect(text(screen.getByTestId("scratch-result"))).toBe("");
    expect(screen.getByTestId("scratch-finished").getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("button", { name: "Buy again" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reveal all" }));
    act(() => {
      vi.advanceTimersByTime(WIPE_MS);
    });
    expect(text(screen.getByTestId("scratch-result"))).toBe("Three coin stacks in a line. Won K₽ 50.");
    expect(screen.getByTestId("scratch-finished").getAttribute("aria-hidden")).toBeNull();
    expect(screen.getAllByTestId("scratch-cell").filter((c) => c.getAttribute("data-mark") === "win")).toHaveLength(3);
    expect(text(screen.getByTestId("scratch-ticket"))).toContain("No. 3456 789");

    fireEvent.click(screen.getByRole("button", { name: "Back to the catalogue" }));
    expect(screen.getByTestId("scratch-catalogue")).toBeTruthy();
  });

  it("plays a treasure ticket spot by spot and counts down what is left", async () => {
    buyScratch.mockResolvedValue(treasure);
    pickScratch.mockImplementation((_id: string, cell: number) =>
      Promise.resolve({ ...treasure.game, picks: [{ cell, find: 500 }], left: 2, cell, find: 500 })
    );
    await act(async () => {
      draw();
    });
    fireEvent.click(screen.getByTestId("ticket-card-treasure"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Buy 1 for/ }));
    });
    expect(screen.getAllByTestId("treasure-spot")).toHaveLength(9);
    expect(text(screen.getByTestId("scratch-ticket"))).toContain("Scratch 3 only. 3 left.");
    expect(text(screen.getByRole("button", { name: /spots left/ }))).toBe("3 spots left to scratch");

    await act(async () => {
      fireEvent.click(screen.getAllByTestId("spot-coating")[4]);
    });
    expect(pickScratch).toHaveBeenCalledWith("SC000000123", 4);
    expect(text(screen.getByTestId("scratch-ticket"))).toContain("Scratch 3 only. 2 left.");
    fireEvent.doubleClick(screen.getAllByTestId("spot-coating")[4]);
    const spot = screen.getAllByTestId("treasure-spot")[4];
    expect(spot.getAttribute("data-mark")).toBe("open");
    expect(text(spot)).toContain("500");
    const pips = screen.getByTestId("ticket-pips");
    expect([...pips.children].map((p) => p.getAttribute("data-mark"))).toEqual(["found", "unscratched", "unscratched"]);
    expect(pips.getAttribute("aria-label")).toBe("2 spots left to scratch");
    expect(text(screen.getByTestId("ticket-progress"))).toMatch(/Found so far\s*K₽ 500/);
  });

  it("shows a stack's pips in the panel and keeps the stage's own counter for narrow screens only", async () => {
    buyScratch.mockResolvedValue({ ...pocket, quantity: 3, tickets: [pocket.tickets[0], pocket.tickets[0], pocket.tickets[0]], totalPayout: 150, balance: 1140 });
    await act(async () => {
      draw();
    });
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Buy 3 for/ }));
    });
    const pips = screen.getByTestId("ticket-pips");
    expect(pips.children).toHaveLength(3);
    expect(pips.children[0].getAttribute("data-current")).toBe("true");
    expect(text(screen.getByTestId("ticket-progress"))).toMatch(/Won so far\s*K₽ 0/);
    expect(screen.queryByRole("button", { name: "3" })).toBeNull();
    expect(screen.getByTestId("stack-progress").className).toContain("lg:hidden");
  });

  it("shows the sign-in button to a visitor", async () => {
    await act(async () => {
      draw(null);
    });
    expect(screen.getByRole("button", { name: "Sign in to play" })).toBeTruthy();
  });
});
