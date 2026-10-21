import { describe, it, expect, vi, afterEach } from "vitest";
import { noteServerTime, resetServerClock, serverNow } from "./serverClock";

describe("the server's clock", () => {
  afterEach(() => {
    resetServerClock();
    vi.useRealTimers();
  });

  it("follows the server on a device an hour behind it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T11:00:00Z"));
    noteServerTime("2026-10-20T12:00:00.000Z");
    vi.advanceTimersByTime(5000);
    expect(serverNow()).toBe(Date.parse("2026-10-20T12:00:05Z"));
  });

  it("keeps the device's own time until the server says something it can read", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T11:00:00Z"));
    noteServerTime(undefined);
    noteServerTime("not a time");
    expect(serverNow()).toBe(Date.parse("2026-10-20T11:00:00Z"));
  });
});
