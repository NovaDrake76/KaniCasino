import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserContext from "../../UserContext";

// the round arrives over the socket, so the test holds it back and hands it over on cue
const handlers: Record<string, (payload: unknown) => void> = {};
vi.mock("../../services/socket", () => ({
  default: {
    getInstance: () => ({
      on: (event: string, fn: (payload: unknown) => void) => {
        handlers[event] = fn;
      },
      off: vi.fn(),
      emit: vi.fn(),
    }),
  },
}));
vi.mock("../../services/games/GamesServices", () => ({ getCoinFlipHistory: () => Promise.resolve([]) }));

import CoinFlip from "./CoinFlip";

const side = () => ({ players: {}, bets: {} });
const round = (version: number) => ({
  heads: side(),
  tails: side(),
  purple: side(),
  version,
  purpleOn: version >= 2,
  pays: version >= 2 ? { side: 2, purple: 32, purpleChance: 0.03 } : { side: 1.94 },
});

const draw = () =>
  render(
    <MemoryRouter>
      <UserContext.Provider value={{ userData: { id: "u1", walletBalance: 1000 } } as never}>
        <CoinFlip />
      </UserContext.Provider>
    </MemoryRouter>
  );

const purpleButton = () => screen.getAllByRole("button").find((b) => /purple/i.test(b.textContent || ""));

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
});

describe("the coin before and after its round arrives", () => {
  // the purple button and its live bets column used to pop in once the socket answered,
  // pushing the page down; their space is held from the first paint instead
  it("holds the purple button's place before the round is known", () => {
    draw();
    const button = purpleButton();
    expect(button).toBeTruthy();
    expect(button!.className).toContain("invisible");
  });

  // before the round lands the page only knows the old 1.94x, which must not flash on the buttons
  it("shows no payout on the buttons until the round says what they pay", () => {
    draw();
    expect(screen.queryAllByText(/^\d+(\.\d+)?x$/)).toHaveLength(0);
  });

  it("puts each side's payout on its own button once the round is in", () => {
    draw();
    act(() => handlers["coinFlip:gameState"](round(2)));
    expect(screen.getAllByText("2x")).toHaveLength(2);
    expect(screen.getByText("32x")).toBeTruthy();
    expect(purpleButton()!.className).not.toContain("invisible");
  });

  it("drops the purple button when the round has no purple side", () => {
    draw();
    act(() => handlers["coinFlip:gameState"](round(1)));
    expect(purpleButton()).toBeUndefined();
    expect(screen.getAllByText("1.94x")).toHaveLength(2);
  });

  it("no longer spells the payouts out under the bet", () => {
    draw();
    act(() => handlers["coinFlip:gameState"](round(2)));
    expect(screen.queryByText("Heads and tails pay 2x")).toBeNull();
    expect(screen.queryByText(/Purple pays 32x and lands/)).toBeNull();
  });
});
