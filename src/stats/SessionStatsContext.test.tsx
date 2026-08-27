import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { SessionStatsProvider, useSessionStats } from "./SessionStatsContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SessionStatsProvider>{children}</SessionStatsProvider>
);

const render = () => renderHook(() => useSessionStats(), { wrapper });

describe("the live stats session", () => {
  beforeEach(() => sessionStorage.clear());

  it("starts empty and closed", () => {
    const { result } = render();
    expect(result.current.stats.rounds).toBe(0);
    expect(result.current.open).toBe(false);
  });

  // the promise made to the player: hiding the panel is not a reset
  it("keeps the tally when the panel is closed", () => {
    const { result } = render();
    act(() => result.current.track({ game: "dice", wagered: 100, payout: 250 }));
    act(() => result.current.setOpen(true));
    act(() => result.current.setOpen(false));
    expect(result.current.stats.rounds).toBe(1);
    expect(result.current.stats.wagered).toBe(100);
  });

  it("clears only when reset is asked for", () => {
    const { result } = render();
    act(() => result.current.track({ game: "dice", wagered: 100, payout: 0 }));
    expect(result.current.stats.rounds).toBe(1);
    act(() => result.current.reset());
    expect(result.current.stats.rounds).toBe(0);
    expect(result.current.stats.wagered).toBe(0);
    expect(result.current.stats.points).toEqual([]);
  });

  // a reload inside the same tab keeps the run; the tab closing is what ends it
  it("survives a remount, because the tab is the session", () => {
    const first = render();
    act(() => first.result.current.track({ game: "mines", wagered: 40, payout: 90 }));
    first.unmount();

    const second = render();
    expect(second.result.current.stats.rounds).toBe(1);
    expect(second.result.current.stats.payout).toBe(90);
  });

  it("remembers where the panel was dragged to", () => {
    const first = render();
    act(() => first.result.current.setPosition({ x: 320, y: 180 }));
    first.unmount();

    const second = render();
    expect(second.result.current.position).toEqual({ x: 320, y: 180 });
  });
});
