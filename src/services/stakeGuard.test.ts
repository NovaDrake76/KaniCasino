import { describe, it, expect, beforeEach, vi } from "vitest";
import { setStakeAtRisk, isStakeAtRisk, whenStakeClears } from "./stakeGuard";

beforeEach(() => setStakeAtRisk(false));

describe("stakeGuard", () => {
  it("runs straight away when nothing is at risk", () => {
    const run = vi.fn();
    whenStakeClears(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("holds while a stake is live and releases when it clears", () => {
    setStakeAtRisk(true);
    const run = vi.fn();
    whenStakeClears(run);
    expect(run).not.toHaveBeenCalled();

    setStakeAtRisk(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("releases everything queued, in order, exactly once", () => {
    setStakeAtRisk(true);
    const order: number[] = [];
    whenStakeClears(() => order.push(1));
    whenStakeClears(() => order.push(2));

    setStakeAtRisk(false);
    expect(order).toEqual([1, 2]);

    // a later clear must not replay them
    setStakeAtRisk(true);
    setStakeAtRisk(false);
    expect(order).toEqual([1, 2]);
  });

  it("a repeated clear does not double-run the queue", () => {
    setStakeAtRisk(true);
    const run = vi.fn();
    whenStakeClears(run);

    setStakeAtRisk(false);
    setStakeAtRisk(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("reports whether a stake is live", () => {
    expect(isStakeAtRisk()).toBe(false);
    setStakeAtRisk(true);
    expect(isStakeAtRisk()).toBe(true);
  });
});
