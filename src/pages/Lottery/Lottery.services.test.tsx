import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import UserContext from "../../UserContext";
import { BALL_MS, REPLAY_MS, RESULT_MS, REVEAL_TOTAL_MS, useLotteryServices } from "./Lottery.services";
import { lotteryState } from "../../test/lotteryFixtures";
import type { DrawnEvent } from "../../services/lottery/LotteryService";

const getLottery = vi.fn();
const buyLotteryTickets = vi.fn();
const getLotteryDraws = vi.fn();
const getDrawTickets = vi.fn();
vi.mock("../../services/lottery/LotteryService", () => ({
  getLottery: (...args: unknown[]) => getLottery(...args),
  buyLotteryTickets: (...args: unknown[]) => buyLotteryTickets(...args),
  getLotteryDraws: (...args: unknown[]) => getLotteryDraws(...args),
  getDrawTickets: (...args: unknown[]) => getDrawTickets(...args),
}));

// the page's socket: handlers registered by the hook, fired by the test as the server would
const handlers = new Map<string, (payload: unknown) => void>();
vi.mock("../../services/socket", () => ({
  default: {
    getInstance: () => ({
      on: (event: string, fn: (payload: unknown) => void) => handlers.set(event, fn),
      off: (event: string) => handlers.delete(event),
    }),
  },
}));
const play = vi.fn();
vi.mock("../../services/sound/sound", () => ({ play: (...args: unknown[]) => play(...args) }));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
const openVerify = vi.fn();
vi.mock("../../components/verify/verifyEvents", () => ({ openVerify: () => openVerify(), handleAccountLock: () => false }));

const toogleUserFlow = vi.fn();
let wallet = 5000;
const toogleUserData = vi.fn((update: unknown) => {
  const next = typeof update === "function" ? update({ walletBalance: wallet }) : update;
  wallet = (next as { walletBalance: number }).walletBalance;
});

const wrapperFor =
  (userData: unknown) =>
  ({ children }: { children: React.ReactNode }) => <UserContext.Provider value={{ userData, toogleUserData, toogleUserFlow } as never}>{children}</UserContext.Provider>;

const player = { id: "u1", walletBalance: 5000 };

const mount = async (userData: unknown = player) => {
  const hook = renderHook(() => useLotteryServices(), { wrapper: wrapperFor(userData) });
  await flush();
  return hook;
};

const label = (s: string) => s.replace(/\s/g, " ");
const flush = () => act(() => Promise.resolve());
// a value the case has just set up; failing here reads better than a property of undefined
const present = <T,>(value: T | null | undefined): T => {
  if (value == null) throw new Error("expected a value");
  return value;
};

const ALL = Array.from({ length: 20 }, (_, i) => i + 1);
const without = (...out: number[]) => ALL.filter((n) => !out.includes(n));
const drawn = (over: Partial<DrawnEvent> = {}): DrawnEvent => ({
  number: 2,
  numbers: [2, 9, 14],
  jackpot: 25175,
  jackpotEach: 0,
  winners: { m1: 0, m2: 0, m3: 0 },
  jackpotWinners: [],
  next: null,
  ...over,
});
const trayOf = (stage: { tray: { n: number | null; tone: string }[] }) => stage.tray.map((b) => (b.n == null ? null : `${b.n}:${b.tone}`));

// the page once draw #2 is settled: draw #3 is on sale and the player's ticket in #2 matched one number
const afterDraw = () => {
  const base = lotteryState();
  return lotteryState({
    draw: { ...present(base.draw), number: 3, jackpot: 25000, tickets: 0, carried: 0 },
    last: { ...present(base.last), number: 2, numbers: [2, 9, 14], jackpot: 25175 },
    me: { tickets: [], count: 0, left: 50, last: { number: 2, tickets: [{ numbers: [1, 2, 3], matches: 1, prize: 100 }], won: 100 } },
  });
};

const SEEN = "lottery.seen.u1";

const setUp = (seen: string | null) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.clearAllMocks();
  handlers.clear();
  wallet = 5000;
  localStorage.clear();
  // the player has already watched draw #1 unless a case says otherwise, so nothing replays on its own
  if (seen) localStorage.setItem(SEEN, seen);
  getLottery.mockResolvedValue(lotteryState());
  getLotteryDraws.mockResolvedValue({ page: 1, pages: 1, draws: [lotteryState().last] });
  getDrawTickets.mockResolvedValue({ number: 1, status: "settled", numbers: [5, 7, 19], tickets: [{ numbers: [5, 7, 8], matches: 2, prize: 300 }], won: 300 });
};

const tearDown = () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
};

// draw #2 is on sale a given time from now
const drawIn = (ms: number, over: Partial<NonNullable<ReturnType<typeof lotteryState>["draw"]>> = {}) => {
  const base = lotteryState();
  const at = Date.now() + ms;
  return { ...base, draw: { ...present(base.draw), drawAt: new Date(at).toISOString(), salesCloseAt: new Date(at - 60000).toISOString(), ...over } };
};

describe("the lottery page", () => {
  beforeEach(() => setUp("1"));
  afterEach(tearDown);

  it("shows the pot, the clock for the next draw, how long the jackpot has rolled and a full drum", async () => {
    const { result } = await mount();
    const { stage } = result.current;
    expect(label(stage.jackpot)).toBe("K₽ 25,175");
    expect(stage.clockLabel).toBe("Draw #2 in");
    expect(stage.countdown).toMatch(/^1:59:5\d$|^2:00:00$/);
    expect(stage.rolling).toBe("Rolling for 1 day");
    expect(stage.status).toBe("4 tickets sold");
    expect(stage.speed).toBe("open");
    expect(stage.drum).toEqual(ALL);
    expect(trayOf(stage)).toEqual([null, null, null]);
    expect(stage.drumLabel).toBe("Lottery drum holding the numbered balls");
  });

  it("prices the prize tiers from the rules", async () => {
    const { result } = await mount();
    const { prizes } = result.current.stage;
    expect(prizes.map((p) => p.label)).toEqual(["Match 3", "Match 2", "Match 1"]);
    expect(prizes.map((p) => label(p.value))).toEqual(["Jackpot", "K₽ 300", "K₽ 100"]);
    expect(prizes.map((p) => p.top)).toEqual([true, false, false]);
  });

  it("shows the pick in progress beside the drum, sorted, with ghosts for the places still empty", async () => {
    const { result } = await mount();
    expect(result.current.stage.pick).toEqual([
      { n: null, tone: "pending" },
      { n: null, tone: "pending" },
      { n: null, tone: "pending" },
    ]);
    act(() => result.current.panel.toggle(19));
    act(() => result.current.panel.toggle(3));
    expect(result.current.stage.pick).toEqual([
      { n: 3, tone: "plain" },
      { n: 19, tone: "plain" },
      { n: null, tone: "pending" },
    ]);
  });

  it("picks up to three numbers, adds them to the slip and prices the buy", async () => {
    const { result } = await mount();
    for (const n of [19, 3, 7]) act(() => result.current.panel.toggle(n));
    act(() => result.current.panel.toggle(11));
    expect(result.current.panel.grid.filter((c) => c.picked).map((c) => c.n)).toEqual([3, 7, 19]);
    expect(result.current.panel.grid.find((c) => c.n === 11)?.muted).toBe(true);
    expect(result.current.panel.canAdd).toBe(true);
    act(() => result.current.panel.addPick());
    expect(result.current.panel.slip.map((r) => r.numbers)).toEqual([[3, 7, 19]]);
    act(() => result.current.panel.addMany(5));
    expect(result.current.panel.slip).toHaveLength(6);
    expect(label(result.current.panel.action.label)).toBe("Buy 6 tickets for K₽ 600");
    expect(result.current.panel.held).toBe("You have 1 of 50 tickets in this draw.");
    act(() => result.current.panel.slip[0].remove());
    expect(result.current.panel.slip).toHaveLength(5);
    expect(play).toHaveBeenCalledWith("lottery.pick");
  });

  it("never lets the slip pass what is left of the cap", async () => {
    getLottery.mockResolvedValue(lotteryState({ me: { tickets: [], count: 45, left: 5, last: null } }));
    const { result } = await mount();
    act(() => result.current.panel.addMany(10));
    expect(result.current.panel.slip).toHaveLength(5);
    expect(result.current.panel.quickMany.every((q) => q.disabled)).toBe(true);
    act(() => result.current.panel.fillPick());
    expect(result.current.panel.canAdd).toBe(false);
  });

  it("buys the slip as one request and shows the new tickets and pot", async () => {
    buyLotteryTickets.mockResolvedValue({ tickets: [{ numbers: [4, 5, 6] }], balance: 4900, draw: { number: 2, jackpot: 25200, tickets: 5 }, me: { count: 2, left: 48 } });
    const { result } = await mount();
    for (const n of [6, 4, 5]) act(() => result.current.panel.toggle(n));
    act(() => result.current.panel.addPick());
    await act(async () => {
      await result.current.panel.action.onClick();
    });
    expect(buyLotteryTickets).toHaveBeenCalledWith([[4, 5, 6]]);
    expect(play).toHaveBeenCalledWith("game.bet");
    expect(wallet).toBe(4900);
    expect(result.current.panel.slip).toHaveLength(0);
    expect(label(result.current.stage.jackpot)).toBe("K₽ 25,200");
    expect(result.current.myTickets?.rows.map((r) => r.balls.map((b) => b.n))).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it("asks a guest to sign in and an unverified player to verify", async () => {
    const guest = await mount(null);
    expect(guest.result.current.panel.action.label).toBe("Sign in to play");
    guest.result.current.panel.action.onClick();
    expect(toogleUserFlow).toHaveBeenCalledWith(true);
    expect(guest.result.current.myTickets).toBeNull();

    const unverified = await mount({ ...player, verification: { verified: false, requiredFrom: "2000-01-01T00:00:00Z", enforced: true } });
    for (const n of [1, 2, 3]) act(() => unverified.result.current.panel.toggle(n));
    act(() => unverified.result.current.panel.addPick());
    expect(unverified.result.current.panel.action.label).toBe("Verify your account to buy");
    unverified.result.current.panel.action.onClick();
    expect(openVerify).toHaveBeenCalled();
    expect(buyLotteryTickets).not.toHaveBeenCalled();
  });

  it("moves the pot when anybody buys", async () => {
    const { result } = await mount();
    act(() => handlers.get("lottery:pot")?.({ draw: 2, jackpot: 26000, tickets: 33 }));
    expect(label(result.current.stage.jackpot)).toBe("K₽ 26,000");
    expect(result.current.stage.status).toBe("33 tickets sold");
    act(() => handlers.get("lottery:pot")?.({ draw: 9, jackpot: 1, tickets: 1 }));
    expect(label(result.current.stage.jackpot)).toBe("K₽ 26,000");
  });

  it("draws the balls out of the drum into the tray, rings the player's numbers, holds the result, then refills", async () => {
    // the player holds 1, 2, 3 in draw #2 and has 14 in the pick being built
    const { result } = await mount();
    act(() => result.current.panel.toggle(14));
    act(() => handlers.get("lottery:drawn")?.(drawn()));
    let stage = result.current.stage;
    expect(stage.speed).toBe("drawing");
    expect(stage.clockLabel).toBe("Drawing #2");
    expect(stage.countdown).toBe("00:00");
    expect(stage.status).toBe("");
    expect(trayOf(stage)).toEqual([null, null, null]);
    expect(stage.drum).toEqual(ALL);

    act(() => vi.advanceTimersByTime(BALL_MS));
    stage = result.current.stage;
    expect(trayOf(stage)).toEqual(["2:hit", null, null]);
    expect(stage.drum).toEqual(without(2));
    expect(play).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenLastCalledWith("lottery.ball");

    act(() => vi.advanceTimersByTime(BALL_MS));
    expect(trayOf(result.current.stage)).toEqual(["2:hit", "9:drawn", null]);
    expect(result.current.stage.drum).toEqual(without(2, 9));

    act(() => vi.advanceTimersByTime(BALL_MS));
    stage = result.current.stage;
    expect(trayOf(stage)).toEqual(["2:hit", "9:drawn", "14:hit"]);
    expect(stage.drum).toEqual(without(2, 9, 14));
    expect(stage.pick[0]).toEqual({ n: 14, tone: "hit" });
    expect(play.mock.calls.filter(([e]) => e === "lottery.ball")).toHaveLength(3);
    expect(stage.drop).toBe(true);

    getLottery.mockResolvedValue(afterDraw());
    await act(async () => {
      vi.advanceTimersByTime(REVEAL_TOTAL_MS - 3 * BALL_MS);
    });
    stage = result.current.stage;
    expect(trayOf(stage)).toEqual(["2:hit", "9:drawn", "14:hit"]);
    expect(stage.drum).toEqual(without(2, 9, 14));
    expect(stage.speed).toBe("open");
    expect(label(stage.status)).toBe("Your tickets won K₽ 100");
    expect(stage.won).toBe(true);
    expect(label(stage.jackpot)).toBe("K₽ 25,175");
    expect(stage.clockLabel).toBe("Drawing #2");
    expect(play).toHaveBeenCalledWith("game.win");
    expect(result.current.myTickets?.title).toBe("My tickets in draw #3");

    act(() => vi.advanceTimersByTime(RESULT_MS));
    stage = result.current.stage;
    expect(trayOf(stage)).toEqual([null, null, null]);
    expect(stage.drum).toEqual(ALL);
    expect(stage.clockLabel).toBe("Draw #3 in");
    expect(label(stage.jackpot)).toBe("K₽ 25,000");
    expect(stage.status).toBe("0 tickets sold");
    expect(stage.won).toBe(false);
    expect(stage.rolling).toBeNull();
  });

  it("leaves a ball without a ring when nobody holds it, and tells a guest how the jackpot went", async () => {
    getLottery.mockResolvedValue(lotteryState({ me: null }));
    const { result } = await mount(null);
    act(() => handlers.get("lottery:drawn")?.(drawn()));
    act(() => vi.advanceTimersByTime(3 * BALL_MS));
    expect(trayOf(result.current.stage)).toEqual(["2:drawn", "9:drawn", "14:drawn"]);
    getLottery.mockResolvedValue({ ...afterDraw(), me: null });
    await act(async () => {
      vi.advanceTimersByTime(REVEAL_TOTAL_MS - 3 * BALL_MS);
    });
    expect(result.current.stage.status).toBe("Nobody matched 3. The jackpot rolled over.");
    expect(result.current.stage.won).toBe(false);
  });

  it("puts every ball in the tray at once, without the drop, for a player who asked for less motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query }));
    try {
      const { result } = await mount();
      act(() => handlers.get("lottery:drawn")?.(drawn({ jackpot: 1 })));
      expect(trayOf(result.current.stage)).toEqual(["2:hit", "9:drawn", "14:drawn"]);
      expect(result.current.stage.drum).toEqual(without(2, 9, 14));
      expect(result.current.stage.drop).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("marks the matched numbers on the player's tickets in the last draw", async () => {
    const { result } = await mount();
    const last = present(result.current.lastDraw);
    expect(last.jackpotLine).toBe("Nobody matched 3. The jackpot rolled over.");
    expect(last.tiers.map((t) => t.value)).toEqual(["1 winning ticket", "2 winning tickets"]);
    expect(last.mine[0].balls.map((b) => b.tone)).toEqual(["hit", "hit", "miss"]);
    expect(label(last.mine[0].prize)).toBe("K₽ 300");
    expect(last.mine[1].prize).toBe("No prize");
    expect(label(last.total || "")).toBe("You won K₽ 300");
  });

  it("names the jackpot winners", async () => {
    const base = lotteryState();
    getLottery.mockResolvedValue({ ...base, last: { ...present(base.last), jackpotEach: 12545, jackpotWinners: [{ userId: "a", username: "kani", tickets: 1 }, { userId: "b", username: "nova", tickets: 1 }] } });
    const { result } = await mount();
    expect(label(present(result.current.lastDraw).jackpotLine)).toBe("Won by kani and nova, K₽ 12,545 each");
  });

  it("checks a past draw in the browser and loads the player's tickets in it", async () => {
    vi.useRealTimers();
    const { result } = await mount();
    await flush();
    const row = result.current.history.rows[0];
    expect(row.label).toBe("Draw #1");
    act(() => row.toggle());
    await flush();
    expect(getDrawTickets).toHaveBeenCalledWith(1);
    await act(async () => {
      await present(result.current.history.rows[0].details).check.run();
    });
    const details = present(result.current.history.rows[0].details);
    expect(details.check.ok).toBe(true);
    expect(details.check.text).toBe("Checked in your browser: the seed matches its hash and draws 5, 7, 19.");
    expect(details.mine.map((m) => m.balls.map((b) => b.n))).toEqual([[5, 7, 8]]);
  });

  it("keeps the clock running in the last minute, says sales are closed and spins the drum faster", async () => {
    const base = lotteryState();
    const soon = Date.now() + 30 * 1000;
    getLottery.mockResolvedValue({ ...base, draw: { ...present(base.draw), drawAt: new Date(soon).toISOString(), salesCloseAt: new Date(soon - 60000).toISOString() } });
    const { result } = await mount();
    expect(result.current.stage.clockLabel).toBe("Draw #2 in");
    expect(result.current.stage.countdown).toMatch(/^00:(2\d|30)$/);
    expect(result.current.stage.status).toBe("Sales closed, drawing soon");
    expect(result.current.stage.speed).toBe("closed");
    expect(result.current.panel.action.disabled).toBe(true);
    expect(result.current.panel.action.label).toBe("Sales are closed for this draw");
  });

  it("spins flat out once the clock has run down, before the numbers arrive", async () => {
    const base = lotteryState();
    const past = Date.now() - 5 * 1000;
    getLottery.mockResolvedValue({
      ...base,
      draw: { ...present(base.draw), status: "drawing", drawAt: new Date(past).toISOString(), salesCloseAt: new Date(past - 60000).toISOString() },
    });
    const { result } = await mount();
    expect(result.current.stage.countdown).toBe("00:00");
    expect(result.current.stage.speed).toBe("drawing");
    expect(result.current.stage.status).toBe("Sales closed, drawing soon");
  });
});

describe("the replay of a missed draw", () => {
  beforeEach(() => setUp(null));
  afterEach(tearDown);

  it("plays the last draw back once to a player who had tickets in it, keeping the open draw's pot and clock", async () => {
    const { result } = await mount();
    expect(localStorage.getItem(SEEN)).toBe("1");
    let stage = result.current.stage;
    expect(stage.speed).toBe("drawing");
    expect(stage.status).toBe("Replay of draw #1");
    expect(label(stage.jackpot)).toBe("K₽ 25,175");
    expect(stage.rolling).toBe("Rolling for 1 day");
    expect(stage.clockLabel).toBe("Draw #2 in");
    expect(stage.countdown).toMatch(/^1:59:5\d$|^2:00:00$/);
    expect(trayOf(stage)).toEqual([null, null, null]);

    // 5 and 7 are on the player's tickets in draw #1, 19 is not
    act(() => vi.advanceTimersByTime(2 * BALL_MS));
    expect(trayOf(result.current.stage)).toEqual(["5:hit", "7:hit", null]);
    act(() => vi.advanceTimersByTime(BALL_MS));
    stage = result.current.stage;
    expect(trayOf(stage)).toEqual(["5:hit", "7:hit", "19:drawn"]);
    expect(stage.drum).toEqual(without(5, 7, 19));
    expect(stage.status).toBe("Replay of draw #1");
    expect(play.mock.calls.filter(([e]) => e === "lottery.ball")).toHaveLength(3);

    act(() => vi.advanceTimersByTime(REVEAL_TOTAL_MS - 3 * BALL_MS));
    stage = result.current.stage;
    expect(label(stage.status)).toBe("Your tickets won K₽ 300");
    expect(stage.won).toBe(true);
    expect(stage.speed).toBe("open");
    expect(stage.clockLabel).toBe("Draw #2 in");
    expect(play).toHaveBeenCalledWith("game.win");

    act(() => vi.advanceTimersByTime(RESULT_MS));
    stage = result.current.stage;
    expect(trayOf(stage)).toEqual([null, null, null]);
    expect(stage.drum).toEqual(ALL);
    expect(stage.status).toBe("4 tickets sold");
    expect(stage.won).toBe(false);
    // the prize was paid at the real draw: nothing was asked of the server and the wallet never moved
    expect(getLottery).toHaveBeenCalledTimes(1);
    expect(toogleUserData).not.toHaveBeenCalled();
  });

  it("does not play the same draw twice", async () => {
    const first = await mount();
    expect(first.result.current.stage.status).toBe("Replay of draw #1");
    first.unmount();
    const again = await mount();
    expect(again.result.current.stage.status).toBe("4 tickets sold");
    expect(trayOf(again.result.current.stage)).toEqual([null, null, null]);
  });

  it("hides the last draw's result from the card and the top of the history until the last ball is in", async () => {
    const { result } = await mount();
    await flush();
    const top = () => result.current.history.rows[0];
    expect(present(result.current.lastDraw).watching).toBe("Watching the draw...");
    expect(present(result.current.lastDraw).watch.disabled).toBe(true);
    expect(top().balls).toEqual([
      { n: null, tone: "pending" },
      { n: null, tone: "pending" },
      { n: null, tone: "pending" },
    ]);
    expect(top().outcome).toBe("");
    act(() => top().toggle());
    expect(top().details).toBeNull();
    act(() => vi.advanceTimersByTime(2 * BALL_MS));
    expect(present(result.current.lastDraw).watching).toBe("Watching the draw...");
    act(() => vi.advanceTimersByTime(BALL_MS));
    expect(present(result.current.lastDraw).watching).toBeNull();
    expect(top().balls.map((b) => b.n)).toEqual([5, 7, 19]);
    expect(top().outcome).toBe("Rolled over");
    expect(top().details).not.toBeNull();
    act(() => vi.advanceTimersByTime(REVEAL_TOTAL_MS - 3 * BALL_MS + RESULT_MS));
    expect(present(result.current.lastDraw).watch.disabled).toBe(false);
  });

  it("leaves a guest and a player with no tickets in the last draw alone", async () => {
    getLottery.mockResolvedValue(lotteryState({ me: null }));
    const guest = await mount(null);
    expect(guest.result.current.stage.status).toBe("4 tickets sold");
    guest.unmount();

    getLottery.mockResolvedValue(lotteryState({ me: { tickets: [], count: 0, left: 50, last: { number: 1, tickets: [], won: 0 } } }));
    const none = await mount();
    expect(none.result.current.stage.status).toBe("4 tickets sold");
    expect(localStorage.getItem(SEEN)).toBeNull();
  });

  it("waits when the replay and its hold would run into the next draw, or the next draw is already under way", async () => {
    getLottery.mockResolvedValue(drawIn(REPLAY_MS - 1000));
    const close = await mount();
    expect(close.result.current.stage.status).not.toBe("Replay of draw #1");
    expect(localStorage.getItem(SEEN)).toBeNull();
    close.unmount();

    getLottery.mockResolvedValue(drawIn(-5000, { status: "drawing" }));
    const drawing = await mount();
    expect(drawing.result.current.stage.status).toBe("Sales closed, drawing soon");
    expect(present(drawing.result.current.lastDraw).watch.disabled).toBe(true);
    expect(localStorage.getItem(SEEN)).toBeNull();
  });

  it("only marks the draw seen for a player who asked for less motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query }));
    const { result } = await mount();
    expect(localStorage.getItem(SEEN)).toBe("1");
    expect(result.current.stage.status).toBe("4 tickets sold");
    expect(trayOf(result.current.stage)).toEqual([null, null, null]);
  });

  it("gives the stage to the live draw when it arrives mid-replay, and counts that draw as seen", async () => {
    const { result } = await mount();
    act(() => vi.advanceTimersByTime(BALL_MS));
    expect(trayOf(result.current.stage)).toEqual(["5:hit", null, null]);
    act(() => handlers.get("lottery:drawn")?.(drawn()));
    let stage = result.current.stage;
    expect(stage.clockLabel).toBe("Drawing #2");
    expect(stage.countdown).toBe("00:00");
    expect(stage.status).toBe("");
    expect(trayOf(stage)).toEqual([null, null, null]);
    expect(present(result.current.lastDraw).watching).toBeNull();
    expect(localStorage.getItem(SEEN)).toBe("2");
    act(() => vi.advanceTimersByTime(3 * BALL_MS));
    stage = result.current.stage;
    expect(trayOf(stage)).toEqual(["2:hit", "9:drawn", "14:drawn"]);
    expect(stage.clockLabel).toBe("Drawing #2");
  });

  it("plays on demand for anyone, unmasked, and ends a guest's on how the jackpot went", async () => {
    getLottery.mockResolvedValue(lotteryState({ me: null }));
    const { result } = await mount(null);
    const watch = present(result.current.lastDraw).watch;
    expect(watch.label).toBe("Watch the draw");
    expect(watch.disabled).toBe(false);
    act(() => watch.onClick());
    expect(result.current.stage.status).toBe("Replay of draw #1");
    expect(present(result.current.lastDraw).watching).toBeNull();
    expect(present(result.current.lastDraw).watch.disabled).toBe(true);
    act(() => vi.advanceTimersByTime(3 * BALL_MS));
    expect(trayOf(result.current.stage)).toEqual(["5:drawn", "7:drawn", "19:drawn"]);
    act(() => vi.advanceTimersByTime(REVEAL_TOTAL_MS - 3 * BALL_MS));
    expect(result.current.stage.status).toBe("Nobody matched 3. The jackpot rolled over.");
    expect(result.current.stage.won).toBe(false);
    expect(Object.keys(localStorage).filter((k) => k.startsWith("lottery.seen"))).toEqual([]);
    act(() => vi.advanceTimersByTime(RESULT_MS));
    expect(result.current.stage.status).toBe("4 tickets sold");
  });

  it("never holds up picking numbers or buying", async () => {
    buyLotteryTickets.mockResolvedValue({ tickets: [{ numbers: [4, 5, 6] }], balance: 4900, draw: { number: 2, jackpot: 25200, tickets: 5 }, me: { count: 2, left: 48 } });
    const { result } = await mount();
    expect(result.current.stage.status).toBe("Replay of draw #1");
    for (const n of [6, 4, 5]) act(() => result.current.panel.toggle(n));
    act(() => result.current.panel.addPick());
    expect(result.current.panel.action.disabled).toBe(false);
    await act(async () => {
      await result.current.panel.action.onClick();
    });
    expect(buyLotteryTickets).toHaveBeenCalledWith([[4, 5, 6]]);
    expect(label(result.current.stage.jackpot)).toBe("K₽ 25,200");
    expect(result.current.stage.status).toBe("Replay of draw #1");
  });
});

describe("repeating the last draw", () => {
  beforeEach(() => setUp("1"));
  afterEach(tearDown);

  const withLast = (numbers: number[][], count = 0) =>
    lotteryState({ me: { tickets: [], count, left: 50 - count, last: { number: 1, tickets: numbers.map((n) => ({ numbers: n, matches: 0, prize: 0 })), won: 0 } } });

  it("puts the player's tickets from the last draw on the slip, in order and duplicates kept", async () => {
    getLottery.mockResolvedValue(withLast([[5, 7, 8], [1, 2, 3], [5, 7, 8]]));
    const { result } = await mount();
    const repeat = present(result.current.panel.repeat);
    expect(repeat.label).toBe("Repeat last draw (3)");
    expect(repeat.disabled).toBe(false);
    act(() => repeat.onClick());
    expect(result.current.panel.slip.map((r) => r.numbers)).toEqual([[5, 7, 8], [1, 2, 3], [5, 7, 8]]);
    expect(play).toHaveBeenCalledWith("lottery.pick");
  });

  it("adds only what still fits under the cap, and is off once nothing does", async () => {
    getLottery.mockResolvedValue(withLast([[5, 7, 8], [1, 2, 3], [9, 10, 11]], 47));
    const { result } = await mount();
    act(() => result.current.panel.addMany(1));
    act(() => present(result.current.panel.repeat).onClick());
    expect(result.current.panel.slip).toHaveLength(3);
    expect(result.current.panel.slip.slice(1).map((r) => r.numbers)).toEqual([[5, 7, 8], [1, 2, 3]]);
    expect(present(result.current.panel.repeat).disabled).toBe(true);
    act(() => present(result.current.panel.repeat).onClick());
    expect(result.current.panel.slip).toHaveLength(3);
  });

  it("is off while sales are closed", async () => {
    getLottery.mockResolvedValue({ ...drawIn(30 * 1000), me: withLast([[5, 7, 8]]).me });
    const { result } = await mount();
    expect(present(result.current.panel.repeat).disabled).toBe(true);
    act(() => present(result.current.panel.repeat).onClick());
    expect(result.current.panel.slip).toHaveLength(0);
  });

  it("is not there for a guest or a player who had no tickets last draw", async () => {
    getLottery.mockResolvedValue(withLast([]));
    const none = await mount();
    expect(none.result.current.panel.repeat).toBeNull();
    none.unmount();
    getLottery.mockResolvedValue(lotteryState({ me: null }));
    const guest = await mount(null);
    expect(guest.result.current.panel.repeat).toBeNull();
  });
});
