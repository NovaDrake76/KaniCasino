import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClaimBonus from "./ClaimBonus";
import UserContext from "../../UserContext";
import { DAISU_STAGE_EVENT } from "../daisu/tour/tourEvents";

// vitest lets a mock factory close over a name starting with "mock"
let mockAdStatus: Record<string, unknown> = { enabled: false, remainingToday: 0 };
vi.mock("../../services/rewards/AdRewardServices", () => ({
  getAdRewardStatus: () => Promise.resolve(mockAdStatus),
  startAdWatch: vi.fn(),
  claimAdReward: vi.fn(),
  showRewardedAd: vi.fn(),
  abandonAdWatch: vi.fn(),
}));

const claimBonus = vi.fn();
vi.mock("../../services/users/UserServices", () => ({ claimBonus: (...args: unknown[]) => claimBonus(...args) }));

const toogleUserData = vi.fn();
const draw = (bonusDate: string, onOpen?: () => void) =>
  render(
    <UserContext.Provider value={{ toogleUserFlow: vi.fn(), toogleUserData } as never}>
      <ClaimBonus bonusDate={bonusDate} userData={{ id: "u1", walletBalance: 10 } as never} potMode onOpen={onOpen} />
    </UserContext.Provider>
  );

const full = () => new Date(Date.now() - 1000).toISOString();
const filling = () => new Date(Date.now() + 125000).toISOString();

// the stage her dock is asked to open to, heard the way the dock hears it
let asked: string[] = [];
const hear = (e: Event) => asked.push((e as CustomEvent<string>).detail);

describe("the bar's bonus button once her jar is the bonus", () => {
  beforeEach(() => {
    claimBonus.mockReset();
    toogleUserData.mockReset();
    mockAdStatus = { enabled: false, remainingToday: 0 };
    asked = [];
    window.addEventListener(DAISU_STAGE_EVENT, hear);
  });
  afterEach(() => window.removeEventListener(DAISU_STAGE_EVENT, hear));

  it("carries only her button, even with an ad reward going", async () => {
    mockAdStatus = { enabled: true, remainingToday: 3, amount: 50, provider: "adsense" };
    draw(full());
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(1));
    expect(screen.getByRole("button").textContent).toContain("Claim Bonus");
  });

  // a claim from the bar used to skip her entirely, so a player who only ever used it never met her
  it("opens her card on a full pot instead of claiming past her", () => {
    draw(full());
    fireEvent.click(screen.getByRole("button", { name: /claim bonus/i }));
    expect(asked).toEqual(["popup"]);
    expect(claimBonus).not.toHaveBeenCalled();
    expect(toogleUserData).not.toHaveBeenCalled();
  });

  it("opens her card from the countdown too, where the jar can be taken early", async () => {
    draw(filling());
    const button = await screen.findByRole("button", { name: /next bonus in/i });
    expect(button.textContent).toMatch(/Next bonus in \d\d:\d\d/);
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);
    expect(asked).toEqual(["popup"]);
    expect(claimBonus).not.toHaveBeenCalled();
  });

  // the phone's sidebar covers the page, and her card would open behind it
  it("lets whatever it sits in close itself first", () => {
    const onOpen = vi.fn();
    draw(full(), onOpen);
    fireEvent.click(screen.getByRole("button", { name: /claim bonus/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(asked).toEqual(["popup"]);
  });
});
