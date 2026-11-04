import { describe, it, expect, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserContext from "../../UserContext";
import { useMinesServices } from "./Mines.services";
import MinesView from "./Mines.view";
import { MinesGameState } from "./Mines.types";

const started = vi.fn();
vi.mock("../../services/games/GamesServices", () => ({
  getActiveMinesGame: () => Promise.resolve({ game: null }),
  startMines: (...args: unknown[]) => started(...args),
  revealMines: vi.fn(),
  cashoutMines: vi.fn(),
}));
vi.mock("../../stats/SessionStatsContext", () => ({ useSessionStats: () => ({ track: () => undefined }) }));
vi.mock("../../services/sound/sound", () => ({ play: () => undefined }));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../../components/game/GameDetails", () => ({ default: () => null }));
vi.mock("../../components/LiveStats/LiveStatsButton", () => ({ default: () => null }));
vi.mock("../../components/daisu/GameBonus", () => ({ GameBonusStrip: () => null, BonusBetHint: () => null }));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UserContext.Provider value={{ userData: { id: "u1", walletBalance: 100000 }, toogleUserFlow: vi.fn() } as never}>
    <MemoryRouter>{children}</MemoryRouter>
  </UserContext.Provider>
);

const busted: MinesGameState = {
  gameId: "g1", status: "busted", actionSeq: 2, betAmount: 50, mineCount: 3, revealed: [4], gems: 0, multiplier: 0,
  nextMultiplier: null, canCashout: false, mineSet: [1, 2, 3], bustTile: 1, payout: 0, rollId: "R1",
};

describe("mines auto play's tiles per round", () => {
  // clamping every keystroke turned an emptied field into 1, so typing a new number meant fighting it
  it("lets the field be cleared and retyped, and clamps only when it is used", () => {
    const { result } = renderHook(() => useMinesServices(), { wrapper });
    act(() => result.current.setAutoPicksInput(""));
    expect(result.current.autoPicksInput).toBe("");
    act(() => result.current.setAutoPicksInput("7"));
    expect(result.current.autoPicks).toBe(7);

    act(() => result.current.setAutoPicksInput("99"));
    expect(result.current.autoPicksInput).toBe("99");
    expect(result.current.autoPicks).toBe(result.current.gemsCount);
    act(() => result.current.normalizeAutoPicks());
    expect(result.current.autoPicksInput).toBe(String(result.current.gemsCount));
  });

  it("follows a change of mines when it no longer fits the gems left", () => {
    const { result } = renderHook(() => useMinesServices(), { wrapper });
    act(() => result.current.setAutoPicksInput("20"));
    act(() => result.current.changeMineCount(20));
    expect(result.current.autoPicks).toBe(result.current.gemsCount);
  });
});

describe("the round result on mines", () => {
  // under the buttons it took Random Tile's place the moment a round ended, and a fast tap left the game
  it("sits above the board, away from the buttons the player was pressing", () => {
    const Page = () => {
      const service = useMinesServices();
      return <MinesView {...service} game={busted} active={false} />;
    };
    render(<Page />, { wrapper });
    const verify = screen.getByRole("button", { name: /verify roll/i });
    const bet = screen.getByRole("button", { name: /^bet$/i });
    expect(bet.parentElement?.contains(verify)).toBe(false);
  });
});
