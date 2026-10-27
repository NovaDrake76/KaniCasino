import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import UserContext from "../../../UserContext";
import { useFandomServices } from "./Fandom.services";

vi.mock("../../../services/fandom/FandomService", () => ({
  getBoards: () => Promise.resolve({ boards: [], totalPages: 1 }),
  getCollectors: () => Promise.resolve({ ranks: [], characterCount: 0 }),
  getReach: () => Promise.resolve([]),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UserContext.Provider value={{ isLogged: false, toogleUserFlow: vi.fn() } as never}>
    <MemoryRouter initialEntries={["/fandom"]}>{children}</MemoryRouter>
  </UserContext.Provider>
);

const useFandomWithLocation = () => ({ ...useFandomServices(), location: useLocation(), navigation: useNavigationType() });

const settle = () =>
  act(async () => {
    vi.advanceTimersByTime(1000);
  });

describe("the top fan page and the back button", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("adds no history entry of its own after it opens", async () => {
    const { result } = renderHook(useFandomWithLocation, { wrapper });
    await settle();
    expect(result.current.navigation).toBe("POP");
    expect(result.current.location.key).toBe("default");
  });

  it("writes a search in place, and a tab change is one entry", async () => {
    const { result } = renderHook(useFandomWithLocation, { wrapper });
    act(() => result.current.setSearch("oguri"));
    await settle();
    expect(result.current.location.search).toBe("?q=oguri");
    expect(result.current.navigation).toBe("REPLACE");

    act(() => result.current.selectTab("biggest"));
    const key = result.current.location.key;
    await settle();
    expect(result.current.navigation).toBe("PUSH");
    expect(result.current.location.key).toBe(key);
    expect(result.current.location.search).toBe("?q=oguri&tab=biggest");
  });
});
