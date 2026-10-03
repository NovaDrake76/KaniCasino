import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHedger, HEDGE_BUDGET, HEDGE_MS, HEDGE_WINDOW_MS } from "./hedge";

// a request that answers after `ms`, with a value or an error, and notices when it is cancelled
const request = (ms: number, outcome: { value?: string; error?: unknown }) => {
  const seen = { aborted: false };
  const send = (signal: AbortSignal) =>
    new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => (outcome.error ? reject(outcome.error) : resolve(outcome.value as string)), ms);
      signal.addEventListener("abort", () => {
        seen.aborted = true;
        clearTimeout(t);
        reject(new Error("canceled"));
      });
    });
  return { send, seen };
};

const serverError = (status: number) => Object.assign(new Error(`status ${status}`), { response: { status } });
const noAnswer = () => Object.assign(new Error("network"), { response: undefined });

describe("a hedged read", () => {
  // a fresh budget per test, the way a fresh tab would have one
  let hedged: ReturnType<typeof createHedger>;
  beforeEach(() => {
    vi.useFakeTimers();
    hedged = createHedger();
  });
  afterEach(() => vi.useRealTimers());

  it("sends one copy when the server answers in time", async () => {
    const first = request(800, { value: "a" });
    const send = vi.fn(first.send);

    const result = hedged(send);
    await vi.advanceTimersByTimeAsync(800);

    await expect(result).resolves.toBe("a");
    await vi.advanceTimersByTimeAsync(HEDGE_MS * 2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("races a second copy against one that is stuck, and cancels the loser", async () => {
    const stuck = request(20000, { value: "late" });
    const fresh = request(400, { value: "fresh" });
    const send = vi.fn().mockImplementationOnce(stuck.send).mockImplementationOnce(fresh.send);

    const result = hedged(send);
    await vi.advanceTimersByTimeAsync(HEDGE_MS + 400);

    await expect(result).resolves.toBe("fresh");
    expect(send).toHaveBeenCalledTimes(2);
    expect(stuck.seen.aborted).toBe(true);
  });

  it("keeps the first copy when it lands before the second", async () => {
    const slow = request(HEDGE_MS + 300, { value: "first" });
    const hedge = request(5000, { value: "second" });
    const send = vi.fn().mockImplementationOnce(slow.send).mockImplementationOnce(hedge.send);

    const result = hedged(send);
    await vi.advanceTimersByTimeAsync(HEDGE_MS + 300);

    await expect(result).resolves.toBe("first");
    expect(hedge.seen.aborted).toBe(true);
  });

  it("takes an error the server sent as the answer, without a second copy", async () => {
    const failing = request(300, { error: serverError(404) });
    const send = vi.fn(failing.send);

    const result = hedged(send);
    const caught = result.catch((e) => e);
    await vi.advanceTimersByTimeAsync(HEDGE_MS * 2);

    expect((await caught).response.status).toBe(404);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("tries once more straight away when the request got no answer at all", async () => {
    const dropped = request(200, { error: noAnswer() });
    const retry = request(300, { value: "ok" });
    const send = vi.fn().mockImplementationOnce(dropped.send).mockImplementationOnce(retry.send);

    const result = hedged(send);
    await vi.advanceTimersByTimeAsync(500);

    await expect(result).resolves.toBe("ok");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("waits for the other copy when one of two fails, and fails only when both do", async () => {
    const stuck = request(6000, { error: serverError(502) });
    const second = request(5000, { error: serverError(500) });
    const send = vi.fn().mockImplementationOnce(stuck.send).mockImplementationOnce(second.send);

    const result = hedged(send);
    const caught = result.catch((e) => e);
    await vi.advanceTimersByTimeAsync(6000);
    expect(send).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(HEDGE_MS + 5000);
    expect((await caught).response.status).toBe(502);
  });

  it("stops sending extra copies once the tab has spent its budget, and earns it back with time", async () => {
    const send = vi.fn((signal: AbortSignal) => request(20000, { value: "slow" }).send(signal));

    for (let i = 0; i < HEDGE_BUDGET + 2; i++) hedged(send).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(HEDGE_MS + 10);
    expect(send).toHaveBeenCalledTimes(HEDGE_BUDGET + 2 + HEDGE_BUDGET);

    await vi.advanceTimersByTimeAsync(HEDGE_WINDOW_MS);
    send.mockClear();
    hedged(send).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(HEDGE_MS + 10);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
