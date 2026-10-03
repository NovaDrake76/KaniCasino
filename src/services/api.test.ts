import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import api from "./api";
import { HEDGE_MS } from "./hedge";

// a server that leaves the first request hanging until it is cancelled and answers the rest at once
const stickyFirst = () => {
  const calls: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = (config) => {
    calls.push(config);
    if (calls.length > 1) return Promise.resolve({ data: { n: calls.length }, status: 200, statusText: "OK", headers: {}, config });
    return new Promise((_, reject) => config.signal?.addEventListener?.("abort", () => reject(new Error("canceled"))));
  };
  return { adapter, calls };
};

describe("the api client on a slow route", () => {
  const original = api.defaults.adapter;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    api.defaults.adapter = original;
  });

  it("races a stuck read with a fresh copy", async () => {
    const server = stickyFirst();
    api.defaults.adapter = server.adapter;

    const res = api.get("/cases");
    await vi.advanceTimersByTimeAsync(HEDGE_MS + 10);

    expect((await res).data).toEqual({ n: 2 });
    expect(server.calls).toHaveLength(2);
  });

  it("never races a read that hands something out once", async () => {
    const server = stickyFirst();
    api.defaults.adapter = server.adapter;

    api.get("/missions/pending?light=1", { timeout: 10000 }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(HEDGE_MS * 3);

    expect(server.calls).toHaveLength(1);
  });

  it("never sends a write twice", async () => {
    const server = stickyFirst();
    api.defaults.adapter = server.adapter;

    api.post("/games/plinko", { betAmount: 1 }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(HEDGE_MS * 3);

    expect(server.calls).toHaveLength(1);
  });
});
