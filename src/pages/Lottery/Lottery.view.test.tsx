import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserContext from "../../UserContext";
import Lottery from "./index";
import { SEED, SEED_HASH, lotteryState } from "../../test/lotteryFixtures";
import { BALL_MS } from "./Lottery.services";

const getLottery = vi.fn();
const buyLotteryTickets = vi.fn();
vi.mock("../../services/lottery/LotteryService", () => ({
  getLottery: (...args: unknown[]) => getLottery(...args),
  buyLotteryTickets: (...args: unknown[]) => buyLotteryTickets(...args),
  getLotteryDraws: () => Promise.resolve({ page: 1, pages: 1, draws: [lotteryState().last] }),
  getDrawTickets: () => Promise.resolve({ number: 1, status: "settled", numbers: [5, 7, 19], tickets: [], won: 0 }),
}));
const handlers = new Map<string, (payload: unknown) => void>();
vi.mock("../../services/socket", () => ({
  default: {
    getInstance: () => ({
      on: (event: string, fn: (payload: unknown) => void) => handlers.set(event, fn),
      off: (event: string) => handlers.delete(event),
    }),
  },
}));
vi.mock("../../services/sound/sound", () => ({ play: () => undefined }));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("../../components/game/GameDetails", () => ({ default: () => null }));

const draw = async (userData: unknown = { id: "u1", walletBalance: 5000 }) => {
  render(
    <UserContext.Provider value={{ userData, toogleUserData: vi.fn(), toogleUserFlow: vi.fn() } as never}>
      <MemoryRouter>
        <Lottery />
      </MemoryRouter>
    </UserContext.Provider>
  );
  await act(() => Promise.resolve());
};

const text = (el: Element | null) => (el?.textContent || "").replace(/\s/g, " ");

describe("the lottery page view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    getLottery.mockResolvedValue(lotteryState());
    // draw #1 has been watched already, so it does not replay on its own unless a case clears this
    localStorage.setItem("lottery.seen.u1", "1");
    // jsdom has no 2d context; the drum's own test draws on a stand-in
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("puts the jackpot over the drum, the empty tray and the clock under it, and the pick and prizes beside it", async () => {
    await draw();
    const stage = screen.getByTestId("lottery-stage");
    expect(text(within(stage).getByTestId("jackpot"))).toBe("K₽ 25,175");
    expect(within(stage).getByTestId("rolling").textContent).toBe("Rolling for 1 day");
    expect(within(stage).getByRole("img", { name: "Lottery drum holding the numbered balls" }).tagName).toBe("CANVAS");
    const tray = within(stage).getByRole("list", { name: "Numbers drawn" });
    expect(within(tray).getAllByTestId("tray-slot")).toHaveLength(3);
    expect(within(tray).queryAllByTestId("ball")).toHaveLength(0);
    expect(within(stage).getByTestId("clock-label").textContent).toBe("Draw #2 in");
    expect(text(within(stage).getByTestId("countdown"))).toMatch(/^\d:\d\d:\d\d$/);
    expect(within(stage).getByTestId("stage-status").textContent).toBe("4 tickets sold");
    const prizes = within(stage).getByTestId("prizes");
    expect(within(prizes).getByText("Match 3")).toBeTruthy();
    expect(within(prizes).getByText("Jackpot")).toBeTruthy();
    // the odds are the game info's to give
    expect(text(prizes)).not.toMatch(/1 in/);
  });

  it("follows the pick in the panel with the balls beside the drum", async () => {
    await draw();
    const mine = screen.getByTestId("your-pick");
    expect(within(mine).getAllByTestId("ball").map((b) => b.textContent)).toEqual(["?", "?", "?"]);
    const grid = screen.getByTestId("number-grid");
    for (const n of ["19", "3"]) fireEvent.click(within(grid).getByRole("button", { name: n }));
    const balls = within(mine).getAllByTestId("ball");
    expect(balls.map((b) => b.textContent)).toEqual(["3", "19", "?"]);
    expect(balls.map((b) => b.getAttribute("data-look"))).toEqual(["drum", "drum", "drum"]);
  });

  it("drops each drawn number into the tray with a gold ring on the player's own", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    try {
      await draw();
      act(() => handlers.get("lottery:drawn")?.({ number: 2, numbers: [2, 9, 14], jackpot: 25175, jackpotEach: 0, winners: { m1: 0, m2: 0, m3: 0 }, jackpotWinners: [], next: null }));
      expect(screen.getByTestId("clock-label").textContent).toBe("Drawing #2");
      act(() => vi.advanceTimersByTime(2 * BALL_MS));
      const balls = within(screen.getByTestId("tray")).getAllByTestId("ball");
      expect(balls.map((b) => b.textContent)).toEqual(["2", "9"]);
      expect(balls.map((b) => b.getAttribute("data-tone"))).toEqual(["hit", "drawn"]);
      expect(balls[0].className).toContain("ring-accent-gold");
      expect(balls[1].className).not.toContain("ring-accent-gold");
      expect(balls[0].className).toContain("motion-safe:animate-ball-drop");
    } finally {
      vi.useRealTimers();
    }
  });

  it("builds a slip from the number grid and buys it", async () => {
    buyLotteryTickets.mockResolvedValue({ tickets: [{ numbers: [3, 7, 19] }], balance: 4900, draw: { number: 2, jackpot: 25200, tickets: 5 }, me: { count: 2, left: 48 } });
    await draw();
    const grid = screen.getByTestId("number-grid");
    expect(within(grid).getAllByRole("button")).toHaveLength(20);
    for (const n of ["19", "3", "7"]) fireEvent.click(within(grid).getByRole("button", { name: n }));
    expect(within(grid).getByRole("button", { name: "7" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("pick-hint").textContent).toBe("3 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Add to slip" }));
    expect(screen.getAllByTestId("slip-row")).toHaveLength(1);
    const buy = screen.getByRole("button", { name: /^Buy 1 ticket for/ });
    await act(async () => {
      fireEvent.click(buy);
    });
    expect(buyLotteryTickets).toHaveBeenCalledWith([[3, 7, 19]]);
    expect(screen.queryAllByTestId("slip-row")).toHaveLength(0);
    expect(screen.getAllByTestId("my-ticket")).toHaveLength(2);
  });

  it("shows the last draw with the player's matched numbers and prize", async () => {
    await draw();
    const last = screen.getByTestId("last-draw");
    expect(within(last).getAllByTestId("ball").slice(0, 3).map((b) => b.textContent)).toEqual(["5", "7", "19"]);
    expect(within(last).getByTestId("jackpot-line").textContent).toBe("Nobody matched 3. The jackpot rolled over.");
    const rows = within(last).getAllByTestId("result-row");
    expect(within(rows[0]).getAllByTestId("ball").map((b) => b.getAttribute("data-tone"))).toEqual(["hit", "hit", "miss"]);
    expect(text(within(last).getByTestId("last-total"))).toBe("You won K₽ 300");
  });

  it("opens a past draw and checks its numbers in the browser", async () => {
    await draw();
    const history = screen.getByTestId("draw-history");
    fireEvent.click(within(history).getByRole("button", { name: /#1/ }));
    await act(() => Promise.resolve());
    const details = screen.getByTestId("draw-details");
    expect(details.textContent).toContain(SEED_HASH);
    expect(details.textContent).toContain(SEED);
    await act(async () => {
      fireEvent.click(within(details).getByRole("button", { name: "Check the numbers" }));
    });
    expect(screen.getByTestId("check-result").textContent).toBe("Checked in your browser: the seed matches its hash and draws 5, 7, 19.");
  });

  it("keeps the last draw under a placeholder while a first replay is drawing, then shows it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    localStorage.clear();
    try {
      await draw();
      const last = screen.getByTestId("last-draw");
      expect(within(last).getByTestId("last-watching").textContent).toBe("Watching the draw...");
      expect(within(last).queryByTestId("jackpot-line")).toBeNull();
      expect(within(last).queryAllByTestId("result-row")).toHaveLength(0);
      expect(within(last).queryAllByTestId("ball")).toHaveLength(0);
      expect(within(last).getByRole("button", { name: "Watch the draw" })).toHaveProperty("disabled", true);
      expect(screen.getByTestId("stage-status").textContent).toBe("Replay of draw #1");
      act(() => vi.advanceTimersByTime(3 * BALL_MS));
      expect(within(last).queryByTestId("last-watching")).toBeNull();
      expect(within(last).getByTestId("jackpot-line").textContent).toBe("Nobody matched 3. The jackpot rolled over.");
      expect(within(last).getAllByTestId("result-row")).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("replays the last draw from its card", async () => {
    await draw();
    const button = within(screen.getByTestId("last-draw")).getByRole("button", { name: "Watch the draw" });
    expect(button).toHaveProperty("disabled", false);
    fireEvent.click(button);
    expect(screen.getByTestId("stage-status").textContent).toBe("Replay of draw #1");
    expect(button).toHaveProperty("disabled", true);
    expect(within(screen.getByTestId("last-draw")).getByTestId("jackpot-line")).toBeTruthy();
  });

  it("repeats the last draw's tickets onto the slip from a chip beside the quick picks", async () => {
    await draw();
    fireEvent.click(screen.getByRole("button", { name: "Repeat last draw (2)" }));
    const rows = screen.getAllByTestId("slip-row");
    expect(rows.map((row) => within(row).getAllByTestId("ball").map((b) => b.textContent))).toEqual([
      ["5", "7", "8"],
      ["1", "2", "3"],
    ]);
  });

  it("leaves a guest out of my tickets and asks them to sign in", async () => {
    getLottery.mockResolvedValue(lotteryState({ me: null }));
    await draw(null);
    expect(screen.queryByTestId("my-tickets")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in to play" })).toBeTruthy();
  });
});
