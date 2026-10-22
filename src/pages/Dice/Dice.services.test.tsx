import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserContext from "../../UserContext";
import { useDiceServices } from "./Dice.services";

const rollDice = vi.fn();
vi.mock("../../services/games/GamesServices", () => ({ rollDice: (...args: unknown[]) => rollDice(...args) }));
vi.mock("../../stats/SessionStatsContext", () => ({ useSessionStats: () => ({ track: () => undefined }) }));
vi.mock("../../services/sound/sound", () => ({ play: () => undefined }));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UserContext.Provider value={{ userData: { id: "u1", walletBalance: 100000 }, toogleUserFlow: vi.fn() } as never}>
    <MemoryRouter>{children}</MemoryRouter>
  </UserContext.Provider>
);

const landed = { won: false, payout: 0, resultValue: 12.34, multiplier: 2, rollId: "R1" };

describe("the dice auto run", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rollDice.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("waits for each roll before the next, so a slow server never has two of the player's bets in flight", async () => {
    const answers: ((v: unknown) => void)[] = [];
    rollDice.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    const { result } = renderHook(() => useDiceServices(), { wrapper });

    act(() => result.current.startAuto());
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(rollDice).toHaveBeenCalledTimes(1);

    await act(async () => {
      answers[0](landed);
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(rollDice).toHaveBeenCalledTimes(2);

    act(() => result.current.stopAuto());
    await act(async () => {
      answers[1](landed);
      vi.advanceTimersByTime(2000);
    });
    expect(rollDice).toHaveBeenCalledTimes(2);
  });
});
