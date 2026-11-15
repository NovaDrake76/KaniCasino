import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomeFeed from "./index";
import { freshest, lateDelay, BOARD_REFRESH_MS, LATE_AFTER_MS, LATE_MAX_MS, LATE_POLL_MS } from "./HomeFeed.services";
import TodayStrip from "../TodayStrip";
import GameListing from "../GamesListing";
import Leaderboard from "../Leaderboard";

const getLotteryPot = vi.fn();
vi.mock("../../../services/lottery/LotteryService", () => ({ getLotteryPot: () => getLotteryPot() }));
const getBoard = vi.fn();
vi.mock("../../../services/leaderboard/LeaderboardService", () => ({ getBoard: () => getBoard(), getPoints: () => Promise.resolve({ games: [] }) }));

// the app's socket, counting who listens: one set of lottery listeners per home visit is the point of the feed
const listeners = new Map<string, Set<(payload: unknown) => void>>();
const on = vi.fn((event: string, fn: (payload: unknown) => void) => {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)?.add(fn);
});
const off = vi.fn((event: string, fn: (payload: unknown) => void) => listeners.get(event)?.delete(fn));
vi.mock("../../../services/socket", () => ({ default: { getInstance: () => ({ on, off }) } }));
const emit = (event: string, payload: unknown) => act(() => listeners.get(event)?.forEach((fn) => fn(payload)));

const NOW = Date.parse("2026-11-15T12:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const pot = (over: Record<string, unknown> = {}) => ({ number: 7, jackpot: 61300, drawAt: iso(NOW + 8 * 3600e3), serverTime: iso(Date.now()), ...over });
const board = (over: Record<string, unknown> = {}) => ({
  boardId: "b1",
  startsAt: iso(NOW - 9 * 3600e3),
  endsAt: iso(NOW + 15 * 3600e3),
  serverTime: iso(Date.now()),
  paidPlaces: 10,
  pool: 21700,
  prizes: [],
  standings: [],
  me: null,
  ...over,
});

const flush = () => act(() => Promise.resolve());
const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush();
};
const lotteryAmount = () => (within(screen.getByTestId("today-lottery")).getByTestId("today-amount").textContent || "").replace(/\s/g, " ");
const lotteryClock = () => within(screen.getByTestId("today-lottery")).queryByTestId("today-clock")?.textContent;

const wholePage = () =>
  render(
    <MemoryRouter>
      <HomeFeed>
        <TodayStrip />
        <GameListing name="Our Games" />
        <Leaderboard />
      </HomeFeed>
    </MemoryRouter>
  );

describe("the home page's shared feed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    listeners.clear();
    getLotteryPot.mockImplementation(() => Promise.resolve(pot()));
    getBoard.mockImplementation(() => Promise.resolve(board()));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for the pot once, listens once and polls the board once for the strip, the tile and the leaderboard together", async () => {
    const view = wholePage();
    await flush();

    expect(getLotteryPot).toHaveBeenCalledTimes(1);
    expect(getBoard).toHaveBeenCalledTimes(1);
    expect(on.mock.calls.filter(([event]) => event === "lottery:pot")).toHaveLength(1);
    expect(on.mock.calls.filter(([event]) => event === "lottery:drawn")).toHaveLength(1);
    expect(screen.getAllByTestId("lottery-pot")).toHaveLength(1);
    expect(lotteryAmount()).toBe("K₽ 61,300");

    await advance(BOARD_REFRESH_MS);
    expect(getBoard).toHaveBeenCalledTimes(2);
    await advance(BOARD_REFRESH_MS);
    expect(getBoard).toHaveBeenCalledTimes(3);
    expect(getLotteryPot).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(listeners.get("lottery:pot")?.size).toBe(0);
    expect(listeners.get("lottery:drawn")?.size).toBe(0);
    await advance(BOARD_REFRESH_MS);
    expect(getBoard).toHaveBeenCalledTimes(3);
  });

  it("re-renders only the clock each second, and nothing around the strip when an answer lands", async () => {
    let renders = 0;
    const Page = () => {
      renders += 1;
      return <div>cases, games and banner</div>;
    };
    render(
      <MemoryRouter>
        <HomeFeed>
          <Page />
          <TodayStrip />
        </HomeFeed>
      </MemoryRouter>
    );
    await flush();
    expect(renders).toBe(1);
    expect(lotteryClock()).toBe("08:00:00");

    await advance(5000);
    expect(lotteryClock()).toBe("07:59:55");
    await advance(BOARD_REFRESH_MS);
    emit("lottery:pot", { draw: 7, jackpot: 61325, tickets: 900 });
    expect(lotteryAmount()).toBe("K₽ 61,325");
    expect(renders).toBe(1);
  });

  it("asks again at a slow, growing pace once the draw's clock has run out, until the next draw is known", async () => {
    getLotteryPot.mockImplementation(() => Promise.resolve(pot({ drawAt: iso(NOW + 10000) })));
    wholePage();
    await flush();
    expect(getLotteryPot).toHaveBeenCalledTimes(1);

    await advance(10000);
    expect(lotteryClock()).toBe("00:00:00");
    await advance(LATE_AFTER_MS - 1);
    expect(getLotteryPot).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(getLotteryPot).toHaveBeenCalledTimes(2);
    expect(lotteryClock()).toBe("00:00:00");

    await advance(LATE_POLL_MS);
    expect(getLotteryPot).toHaveBeenCalledTimes(3);
    await advance(LATE_POLL_MS);
    expect(getLotteryPot).toHaveBeenCalledTimes(3);
    await advance(LATE_POLL_MS);
    expect(getLotteryPot).toHaveBeenCalledTimes(4);

    getLotteryPot.mockImplementation(() => Promise.resolve(pot({ number: 8, jackpot: 25000, drawAt: iso(NOW + 24 * 3600e3) })));
    await advance(4 * LATE_POLL_MS);
    expect(getLotteryPot).toHaveBeenCalledTimes(5);
    expect(lotteryAmount()).toBe("K₽ 25,000");
    await advance(30 * 60 * 1000);
    expect(getLotteryPot).toHaveBeenCalledTimes(5);
  });

  it("asks nothing more when the socket brings the next draw", async () => {
    getLotteryPot.mockImplementation(() => Promise.resolve(pot({ drawAt: iso(NOW + 10000) })));
    wholePage();
    await flush();
    await advance(10000);
    emit("lottery:drawn", { number: 7, numbers: [1, 2, 3], jackpot: 61300, next: { number: 8, jackpot: 25000, drawAt: iso(NOW + 24 * 3600e3) } });
    expect(lotteryAmount()).toBe("K₽ 25,000");
    expect(lotteryClock()).toBe("23:59:50");
    await advance(10 * 60 * 1000);
    expect(getLotteryPot).toHaveBeenCalledTimes(1);
  });

  it("never waits less than twenty seconds or more than five minutes between late asks", () => {
    expect([1, 2, 3, 4, 5, 6, 40].map(lateDelay)).toEqual([20000, 40000, 80000, 160000, LATE_MAX_MS, LATE_MAX_MS, LATE_MAX_MS]);
  });

  it("pulls the new board once when the day resets, not every second", async () => {
    getBoard.mockImplementationOnce(() => Promise.resolve(board({ endsAt: iso(NOW + 5000) })));
    wholePage();
    await flush();
    expect(getBoard).toHaveBeenCalledTimes(1);
    await advance(5000);
    expect(getBoard).toHaveBeenCalledTimes(2);
    await advance(10000);
    expect(getBoard).toHaveBeenCalledTimes(2);
  });

  it("keeps the newer pot when an older answer lands after it", () => {
    const at = { number: 7, jackpot: 61300, drawAt: iso(NOW) };
    const later = { ...at, jackpot: 61400 };
    expect(freshest(later, at)).toBe(later);
    expect(freshest(at, later)).toBe(later);
    const next = { number: 8, jackpot: 25000, drawAt: at.drawAt };
    expect(freshest(next, later)).toBe(next);
    expect(freshest(null, at)).toBe(at);
    expect(freshest(at, null)).toBe(at);
  });
});
