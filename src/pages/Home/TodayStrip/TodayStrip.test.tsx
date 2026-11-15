import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomeFeed from "../HomeFeed";
import TodayStrip from "./index";
import { youChip } from "./TodayStrip.services";
import { clockText } from "./Clock/Clock.services";

const getLotteryPot = vi.fn();
vi.mock("../../../services/lottery/LotteryService", () => ({ getLotteryPot: () => getLotteryPot() }));
const getBoard = vi.fn();
vi.mock("../../../services/leaderboard/LeaderboardService", () => ({ getBoard: () => getBoard() }));

const handlers = new Map<string, (payload: unknown) => void>();
vi.mock("../../../services/socket", () => ({
  default: {
    getInstance: () => ({
      on: (event: string, fn: (payload: unknown) => void) => handlers.set(event, fn),
      off: (event: string) => handlers.delete(event),
    }),
  },
}));

const NOW = Date.parse("2026-11-15T12:00:00.000Z");
const HOUR = 3600e3;
const iso = (ms: number) => new Date(ms).toISOString();
const POT = { number: 7, jackpot: 38425, drawAt: iso(NOW + 8 * HOUR), serverTime: iso(NOW) };
const BOARD = {
  boardId: "b1",
  startsAt: iso(NOW - 9 * HOUR),
  endsAt: iso(NOW + 15 * HOUR),
  serverTime: iso(NOW),
  paidPlaces: 10,
  pool: 21700,
  prizes: [],
  standings: [],
  me: null,
};
const ranked = { _id: "u1", points: 900, bets: 3, rank: 12, toPaidPlace: 400, prize: 0 };

const flush = () => act(() => Promise.resolve());
const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush();
};
const card = (name: "lottery" | "leaderboard") => screen.getByTestId(`today-${name}`);
const amount = (name: "lottery" | "leaderboard") => (within(card(name)).getByTestId("today-amount").textContent || "").replace(/\s/g, " ");
const clock = (name: "lottery" | "leaderboard") => within(card(name)).queryByTestId("today-clock")?.textContent ?? null;

const show = async () => {
  const view = render(
    <MemoryRouter>
      <HomeFeed>
        <TodayStrip />
      </HomeFeed>
    </MemoryRouter>
  );
  await flush();
  return view;
};

describe("the today strip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    handlers.clear();
    getLotteryPot.mockResolvedValue(POT);
    getBoard.mockResolvedValue(BOARD);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("holds both cards in place with placeholders until the answers arrive", async () => {
    let answerPot: (value: unknown) => void = () => undefined;
    let answerBoard: (value: unknown) => void = () => undefined;
    getLotteryPot.mockReturnValue(new Promise((resolve) => (answerPot = resolve)));
    getBoard.mockReturnValue(new Promise((resolve) => (answerBoard = resolve)));
    await show();

    expect(screen.getByText("Daily Lottery")).toBeTruthy();
    expect(screen.getByText("Daily Leaderboard")).toBeTruthy();
    // the amount and the clock each, in a phone size and a desktop size; css shows one of each pair
    expect(within(card("lottery")).getAllByTestId("today-pending")).toHaveLength(4);
    expect(within(card("leaderboard")).getAllByTestId("today-pending")).toHaveLength(4);
    expect(clock("lottery")).toBeNull();
    expect(card("lottery").getAttribute("href")).toBe("/lottery");

    await act(async () => {
      answerPot(POT);
      answerBoard(BOARD);
    });
    expect(screen.queryAllByTestId("today-pending")).toHaveLength(0);
    expect(amount("lottery")).toBe("K₽ 38,425");
    expect(amount("leaderboard")).toBe("K₽ 21,700");
  });

  it("counts down to the draw and the reset on the server's clock, not the device's", async () => {
    // the device runs an hour fast: both answers say it is an hour earlier than it thinks
    getLotteryPot.mockResolvedValue({ ...POT, drawAt: iso(NOW + HOUR), serverTime: iso(NOW - HOUR) });
    getBoard.mockResolvedValue({ ...BOARD, endsAt: iso(NOW + 2 * HOUR), serverTime: iso(NOW - HOUR) });
    await show();

    expect(clock("lottery")).toBe("02:00:00");
    expect(clock("leaderboard")).toBe("03:00:00");
    await advance(1000);
    expect(clock("lottery")).toBe("01:59:59");
    expect(clock("leaderboard")).toBe("02:59:59");
  });

  it("stops the lottery clock at zero until the next draw is known", async () => {
    getLotteryPot.mockResolvedValue({ ...POT, drawAt: iso(NOW + 3000) });
    await show();
    await advance(3000);
    expect(clock("lottery")).toBe("00:00:00");
    await advance(10000);
    expect(clock("lottery")).toBe("00:00:00");
    expect(amount("lottery")).toBe("K₽ 38,425");
  });

  it("shows a dash and no clock when a read fails, and both cards still lead somewhere", async () => {
    getLotteryPot.mockRejectedValue(new Error("offline"));
    getBoard.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await show();

    expect(amount("lottery")).toBe("-");
    expect(amount("leaderboard")).toBe("-");
    expect(clock("lottery")).toBeNull();
    expect(clock("leaderboard")).toBeNull();
    expect(screen.queryAllByTestId("today-pending")).toHaveLength(0);
    expect(card("lottery").getAttribute("href")).toBe("/lottery");
    expect(card("leaderboard").getAttribute("href")).toBe("#leaderboard");
  });

  it("shows a dash and no clock on the lottery card when no draw is open", async () => {
    getLotteryPot.mockResolvedValue(null);
    await show();
    expect(amount("lottery")).toBe("-");
    expect(clock("lottery")).toBeNull();
    expect(amount("leaderboard")).toBe("K₽ 21,700");
    expect(clock("leaderboard")).toBe("15:00:00");
  });

  it("moves the jackpot with every ticket sold in the open draw, and with the next draw once it is drawn", async () => {
    await show();
    act(() => handlers.get("lottery:pot")?.({ draw: 7, jackpot: 38450, tickets: 30 }));
    expect(amount("lottery")).toBe("K₽ 38,450");
    act(() => handlers.get("lottery:pot")?.({ draw: 6, jackpot: 99999, tickets: 1 }));
    expect(amount("lottery")).toBe("K₽ 38,450");
    act(() => handlers.get("lottery:drawn")?.({ number: 7, numbers: [1, 2, 3], jackpot: 38450, next: { number: 8, jackpot: 25000, drawAt: iso(NOW + 9 * HOUR) } }));
    expect(amount("lottery")).toBe("K₽ 25,000");
    expect(clock("lottery")).toBe("09:00:00");
  });

  it("shows the player's place only when they hold a rank", async () => {
    expect(youChip(null)).toBeNull();
    expect(youChip(ranked)).toEqual({ full: "You #12", short: "#12" });
    expect(youChip({ ...ranked, rank: null })).toBeNull();
    expect(youChip({ ...ranked, needsVerify: true })).toBeNull();
    expect(youChip({ ...ranked, limited: true })).toBeNull();

    getBoard.mockResolvedValue({ ...BOARD, me: ranked });
    const view = await show();
    // with the word beside the name from md up, the place alone at the end of the clock row on a phone; css shows one of them
    expect(within(card("leaderboard")).getAllByText("You #12")).toHaveLength(1);
    expect(within(card("leaderboard")).getAllByText("#12")).toHaveLength(1);
    expect(within(card("lottery")).queryByText(/#12/)).toBeNull();
    view.unmount();

    getBoard.mockResolvedValue({ ...BOARD, me: { ...ranked, rank: null } });
    await show();
    expect(screen.queryByText(/#\d/)).toBeNull();
  });

  it("has no chip for a guest", async () => {
    await show();
    expect(screen.queryByText(/#\d/)).toBeNull();
  });

  it("scrolls to the leaderboard rather than jumping, unless the player asked for less motion", async () => {
    const section = document.createElement("section");
    section.id = "leaderboard";
    section.scrollIntoView = vi.fn();
    document.body.appendChild(section);
    await show();

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(card("leaderboard"), click);
    expect(click.defaultPrevented).toBe(true);
    expect(section.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes("reduce") })) as never;
    fireEvent.click(card("leaderboard"));
    expect(section.scrollIntoView).toHaveBeenLastCalledWith({ behavior: "auto", block: "start" });
    window.matchMedia = matchMedia;
    section.remove();
  });

  it("writes the time left as hours, minutes and seconds", () => {
    expect(clockText(0)).toBe("00:00:00");
    expect(clockText(-5000)).toBe("00:00:00");
    expect(clockText((3 * 3600 + 4 * 60 + 5) * 1000 + 999)).toBe("03:04:05");
  });
});
