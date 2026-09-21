import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClaimBonus from "./ClaimBonus";
import UserContext from "../../UserContext";
import { JAR_TAKEN_EVENT } from "../daisu/tour/tourEvents";

// vitest lets a mock factory close over a name starting with "mock"
let mockAdStatus: Record<string, unknown> = { enabled: false, remainingToday: 0 };
vi.mock("../../services/rewards/AdRewardServices", () => ({
  getAdRewardStatus: () => Promise.resolve(mockAdStatus),
  startAdWatch: vi.fn(),
  claimAdReward: vi.fn(),
  showRewardedAd: vi.fn(),
  abandonAdWatch: vi.fn(),
}));
vi.mock("../../services/users/UserServices", () => ({ claimBonus: vi.fn() }));

const claimPot = vi.fn();
vi.mock("../../services/daisu/DaisuService", () => ({
  claimPot: (...args: unknown[]) => claimPot(...args),
}));

const toogleUserData = vi.fn();
const draw = (bonusDate: string) =>
  render(
    <UserContext.Provider value={{ toogleUserFlow: vi.fn(), toogleUserData } as never}>
      <ClaimBonus bonusDate={bonusDate} userData={{ id: "u1", walletBalance: 10 } as never} potMode />
    </UserContext.Provider>
  );

describe("the navbar bonus button in daisu's beta", () => {
  beforeEach(() => {
    claimPot.mockReset();
    toogleUserData.mockReset();
    mockAdStatus = { enabled: false, remainingToday: 0 };
  });

  // her jar is the bonus in pot mode, so the bar carries that and nothing beside it
  it("carries only her button, even with an ad reward going", async () => {
    mockAdStatus = { enabled: true, remainingToday: 3, amount: 50, provider: "adsense" };
    draw(new Date(Date.now() - 1000).toISOString());
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(1));
    expect(screen.getByRole("button").textContent).toContain("Claim Bonus");
  });

  it("takes what is in her jar straight to the wallet", async () => {
    const taken = vi.fn();
    window.addEventListener(JAR_TAKEN_EVENT, taken);
    claimPot.mockResolvedValue({ amount: 400, walletBalance: 410, nextBonus: "2030-01-01T00:00:00.000Z", status: {} });
    draw(new Date(Date.now() + 125000).toISOString());

    fireEvent.click(screen.getByRole("button", { name: /claim bonus/i }));

    await waitFor(() => expect(toogleUserData).toHaveBeenCalledWith(expect.objectContaining({ walletBalance: 410 })));
    expect(claimPot).toHaveBeenCalledTimes(1);
    expect(taken).toHaveBeenCalledTimes(1);
    window.removeEventListener(JAR_TAKEN_EVENT, taken);
  });

  it("leaves the wallet alone when the jar is empty", async () => {
    claimPot.mockRejectedValue({ response: { data: { message: "The pot is empty" } } });
    draw(new Date(Date.now() + 480000).toISOString());

    fireEvent.click(screen.getByRole("button", { name: /claim bonus/i }));

    await waitFor(() => expect(claimPot).toHaveBeenCalledTimes(1));
    expect(toogleUserData).not.toHaveBeenCalled();
  });
});
