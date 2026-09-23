import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const post = vi.fn(() => Promise.resolve());
vi.mock("../api", () => ({ default: { post: (...args: unknown[]) => post(...(args as [])) } }));

import { flushUsage, track } from "./usage";

type Sent = { sid: string; events: { name: string; params: Record<string, unknown>; path: string; ago: number }[] };
const sent = (call = 0) => (post.mock.calls[call] as unknown as [string, Sent])[1];

describe("the usage record, from the page's side", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem("accessToken", "t");
    flushUsage();
    post.mockClear();
  });
  afterEach(() => {
    flushUsage();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("holds events and sends them together half a minute after the first", () => {
    track("daisu_open", { via: "bubble", showing: "jar", attention: false });
    vi.advanceTimersByTime(5000);
    track("daisu_room", { via: "card_missions", from: "popup" });
    vi.advanceTimersByTime(24000);
    expect(post).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe("/usage");
    const batch = sent();
    expect(batch.events.map((e) => [e.name, e.params.via, e.ago])).toEqual([
      ["daisu_open", "bubble", 30000],
      ["daisu_room", "card_missions", 25000],
    ]);
    expect(batch.sid).toMatch(/^[a-z0-9]+$/);
  });

  it("sends at once when a batch fills, and never sends the same event twice", () => {
    for (let i = 0; i < 20; i++) track("tour_step", { step: "pot" });

    expect(post).toHaveBeenCalledTimes(1);
    expect(sent().events).toHaveLength(20);
    flushUsage();
    vi.advanceTimersByTime(60000);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("records nothing for a visitor who is not signed in", () => {
    localStorage.removeItem("accessToken");
    track("locked_view", { unlock: "spyglass" });
    vi.advanceTimersByTime(60000);

    expect(post).not.toHaveBeenCalled();
  });

  // a closing tab cancels the axios request, and a keepalive fetch is the one that outlives it
  it("hands what is left to a keepalive request when the tab is hidden", () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchSpy);
    track("help_end", { goal: "gift", step: "start" });

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(post).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toMatch(/\/usage$/);
    expect(init.keepalive).toBe(true);
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(JSON.parse(String(init.body)).events[0].name).toBe("help_end");
    delete (document as { visibilityState?: string }).visibilityState;
    vi.unstubAllGlobals();
  });
});
