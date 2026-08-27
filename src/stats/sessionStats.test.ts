import { describe, it, expect } from "vitest";
import { EMPTY, MAX_POINTS, applyRound, profitOf } from "./sessionStats";

const play = (rounds: Array<[number, number]>) =>
  rounds.reduce((s, [wagered, payout]) => applyRound(s, { game: "dice", wagered, payout }), EMPTY);

describe("the session tally", () => {
  it("starts empty", () => {
    expect(EMPTY.rounds).toBe(0);
    expect(profitOf(EMPTY)).toBe(0);
  });

  it("nets profit against what was staked, not against the payout alone", () => {
    const s = play([[100, 0], [100, 250]]);
    expect(s.wagered).toBe(200);
    expect(s.payout).toBe(250);
    expect(profitOf(s)).toBe(50);
  });

  it("counts a win only when the round returned more than it took", () => {
    const s = play([[100, 200], [100, 0], [100, 100]]);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(1);
    // the push is a round, and it is neither a win nor a loss
    expect(s.rounds).toBe(3);
  });

  it("plots cumulative profit, so the line is the running total", () => {
    const s = play([[100, 0], [100, 300], [100, 0]]);
    expect(s.points).toEqual([-100, 100, 0]);
  });

  it("keeps the totals exact while the graph is only a window", () => {
    const many: Array<[number, number]> = Array.from({ length: MAX_POINTS + 250 }, () => [10, 0]);
    const s = play(many);
    expect(s.rounds).toBe(MAX_POINTS + 250);
    expect(s.wagered).toBe((MAX_POINTS + 250) * 10);
    expect(profitOf(s)).toBe(-(MAX_POINTS + 250) * 10);
    expect(s.points).toHaveLength(MAX_POINTS);
    // the window ends on the newest round, not the oldest
    expect(s.points[s.points.length - 1]).toBe(-(MAX_POINTS + 250) * 10);
  });

  it("never mutates the tally it was handed", () => {
    const first = play([[100, 0]]);
    const second = applyRound(first, { game: "dice", wagered: 50, payout: 90 });
    expect(first.rounds).toBe(1);
    expect(first.points).toEqual([-100]);
    expect(second.rounds).toBe(2);
  });
});
