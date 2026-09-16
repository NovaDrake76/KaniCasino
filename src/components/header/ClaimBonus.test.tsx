import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ClaimBonus from "./ClaimBonus";
import UserContext from "../../UserContext";
import { DAISU_STAGE_EVENT } from "../daisu/tour/tourEvents";

vi.mock("../../services/rewards/AdRewardServices", () => ({
  getAdRewardStatus: () => Promise.resolve({ enabled: false, remainingToday: 0 }),
  startAdWatch: vi.fn(),
  claimAdReward: vi.fn(),
  showRewardedAd: vi.fn(),
  abandonAdWatch: vi.fn(),
}));
vi.mock("../../services/users/UserServices", () => ({ claimBonus: vi.fn() }));

const draw = (bonusDate: string) =>
  render(
    <UserContext.Provider value={{ toogleUserFlow: vi.fn(), toogleUserData: vi.fn() } as never}>
      <ClaimBonus bonusDate={bonusDate} userData={{ id: "u1", walletBalance: 10 } as never} potMode />
    </UserContext.Provider>
  );

describe("the navbar bonus button in daisu's beta", () => {
  const stages: string[] = [];
  const onStage = (e: Event) => stages.push((e as CustomEvent<string>).detail);
  afterEach(() => {
    window.removeEventListener(DAISU_STAGE_EVENT, onStage);
    stages.length = 0;
  });

  it("says the bonus is ready once the pot is full, and opens her card", () => {
    window.addEventListener(DAISU_STAGE_EVENT, onStage);
    draw(new Date(Date.now() - 1000).toISOString());

    fireEvent.click(screen.getByRole("button", { name: /bonus ready/i }));
    expect(stages).toEqual(["popup"]);
  });

  it("counts down to a full pot until then, and still opens her card", () => {
    window.addEventListener(DAISU_STAGE_EVENT, onStage);
    draw(new Date(Date.now() + 125000).toISOString());

    fireEvent.click(screen.getByRole("button", { name: /next bonus in 02:0\d/i }));
    expect(stages).toEqual(["popup"]);
  });
});
