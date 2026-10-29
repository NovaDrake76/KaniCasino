import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import UserContext from "../../UserContext";
import { SessionStatsProvider } from "../../stats/SessionStatsContext";
import LiveStatsButton from "./LiveStatsButton";

vi.mock("../daisu/shop/shopStore", () => ({ loadShop: () => Promise.resolve(null), useShopState: () => null }));
const track = vi.fn();
vi.mock("../../services/usage/usage", () => ({ track: (...args: unknown[]) => track(...args) }));

const draw = (userData: object) =>
  render(
    <UserContext.Provider value={{ userData } as never}>
      <SessionStatsProvider>
        <LiveStatsButton />
      </SessionStatsProvider>
    </UserContext.Provider>
  );

describe("the live stats icon under a game", () => {
  beforeEach(() => {
    sessionStorage.clear();
    track.mockClear();
  });

  // the icon was the thing on a game page nobody clicked, so it became something to buy
  it("is a locked icon for an account in her beta without the spyglass, pointing at her shop", () => {
    const asked: string[] = [];
    const onShop = (e: Event) => asked.push((e as CustomEvent<string>).detail);
    window.addEventListener("daisu:shop", onShop);
    draw({ id: "u1", features: { daisu: true }, unlocks: [] });

    expect(track).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /live stats need a spyglass/i }));
    expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
    expect(track).toHaveBeenCalledWith("locked_view", { unlock: "spyglass" });

    fireEvent.click(screen.getByRole("button", { name: /get the spyglass/i }));
    expect(asked).toEqual(["spyglass"]);
    expect(screen.queryByRole("button", { name: /get the spyglass/i })).toBeNull();
    window.removeEventListener("daisu:shop", onShop);
  });

  it("opens the stats once the spyglass is held, and always outside her beta", () => {
    const { unmount } = draw({ id: "u1", features: { daisu: true }, unlocks: ["spyglass"] });
    fireEvent.click(screen.getByRole("button", { name: /^live stats$/i }));
    expect(screen.getByRole("button", { name: /reset/i })).toBeTruthy();
    unmount();

    sessionStorage.clear();
    draw({ id: "u2", features: {}, unlocks: [] });
    fireEvent.click(screen.getByRole("button", { name: /^live stats$/i }));
    expect(screen.getByRole("button", { name: /reset/i })).toBeTruthy();
    expect(screen.queryByText(/spyglass/i)).toBeNull();
  });
});
