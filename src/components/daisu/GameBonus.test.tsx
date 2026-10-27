import { describe, it, expect, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { BonusBetHint, GameBonusStrip } from "./GameBonus";
import { setPotStatus } from "./potStore";
import type { PotBonus, PotStatus } from "../../services/daisu/DaisuService";

const CYCLE = 8 * 60000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

const pot = (bonuses: PotBonus[]): PotStatus => ({
  fill: 0.5,
  full: 1000,
  amount: 400,
  fullAt: iso(CYCLE / 2),
  cycleMs: CYCLE,
  clickRate: 0.8,
  fullBonus: 0.25,
  creditShare: 0.1,
  pick: "dice",
  nextPick: "plinko",
  pickProgress: 0,
  creditTtlMs: CYCLE,
  bonuses,
});

const draw = (bet: number) =>
  render(
    <div>
      <GameBonusStrip game="dice" />
      <BonusBetHint game="dice" bet={bet} />
    </div>
  );

describe("daisu's bonus inside a game", () => {
  afterEach(() => {
    act(() => setPotStatus(null));
  });

  it("stays out of the panel when there is no bonus", () => {
    const { container } = draw(10);
    expect(container.textContent).toBe("");
  });

  it("shows this game's bonus with its clock, and says the bonus pays a bet it covers", () => {
    setPotStatus(pot([{ game: "dice", amount: 85, expiresAt: iso(160500), expired: false }]));
    draw(10);

    expect(screen.getByText(/dice bonus balance/i)).toBeTruthy();
    expect(screen.getByText(/spent first/i)).toBeTruthy();
    expect(screen.getByText("2:41")).toBeTruthy();
    expect(screen.getByText(/this bet/i).textContent).toMatch(/K₽\s10 from your bonus, nothing from your wallet/);
  });

  it("splits a bet bigger than the bonus between the bonus and the wallet, to the cent", () => {
    setPotStatus(pot([{ game: "dice", amount: 4.5, expiresAt: iso(160000), expired: false }]));
    draw(10);

    expect(screen.getByText(/this bet/i).textContent).toMatch(/K₽\s4\.50 from your bonus, K₽\s5\.50 from your wallet/);
  });

  it("drops the strip once whole bets leave only cents, which the next bet still takes", () => {
    setPotStatus(pot([{ game: "dice", amount: 0.53, expiresAt: iso(91000), expired: false }]));
    draw(10);

    expect(screen.queryByText(/dice bonus balance/i)).toBeNull();
    expect(screen.getByText(/this bet/i).textContent).toMatch(/K₽\s0\.53 from your bonus, K₽\s9\.47 from your wallet/);
  });

  it("keeps out of games the bonus is not for, and out of the way once it has expired", () => {
    setPotStatus(
      pot([
        { game: "plinko", amount: 85, expiresAt: iso(160000), expired: false },
        { game: "dice", amount: 40, expiresAt: iso(-1000), expired: true },
      ])
    );
    const { container } = draw(10);
    expect(container.textContent).toBe("");
  });
});
