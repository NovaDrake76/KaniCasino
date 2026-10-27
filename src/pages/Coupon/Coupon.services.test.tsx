import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserContext from "../../UserContext";
import { problemOf, useCouponServices } from "./Coupon.services";

const redeemCoupon = vi.fn();
vi.mock("../../services/coupons/CouponService", async (original) => ({
  ...(await original<typeof import("../../services/coupons/CouponService")>()),
  redeemCoupon: (...args: unknown[]) => redeemCoupon(...args),
}));
const handleAccountLock = vi.fn();
vi.mock("../../components/verify/verifyEvents", () => ({ handleAccountLock: (...args: unknown[]) => handleAccountLock(...args) }));

const toogleUserFlow = vi.fn();
const toogleUserData = vi.fn();
let isLogged = true;

const wrapper =
  (path: string) =>
  ({ children }: { children: React.ReactNode }) => (
    <UserContext.Provider value={{ isLogged, toogleUserFlow, toogleUserData, userData: { id: "u1", walletBalance: 100 } } as never}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/coupon" element={children} />
          <Route path="/coupon/:code" element={children} />
        </Routes>
      </MemoryRouter>
    </UserContext.Provider>
  );

const fail = (reason: string) => Object.assign(new Error("no"), { response: { status: 410, data: { reason } } });

describe("the redeem page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    isLogged = true;
    redeemCoupon.mockResolvedValue({ redeemed: true, amount: 500, walletBalance: 600 });
  });

  it("redeems the code a link carries, once, and moves the wallet", async () => {
    const { result } = renderHook(useCouponServices, { wrapper: wrapper("/coupon/K7QX9MPLA2") });

    await waitFor(() => expect(result.current.state).toEqual({ kind: "done", amount: 500 }));
    expect(redeemCoupon).toHaveBeenCalledTimes(1);
    expect(redeemCoupon).toHaveBeenCalledWith("K7QX9MPLA2");
    expect(toogleUserData.mock.calls[0][0].walletBalance).toBe(600);
    expect(result.current.code).toBe("K7QX9MPLA2");
  });

  it("asks a signed-out visitor to log in, keeps the code, and redeems it once they are in", async () => {
    isLogged = false;
    const { result, rerender } = renderHook(useCouponServices, { wrapper: wrapper("/coupon/K7QX9MPLA2") });

    expect(result.current.state).toEqual({ kind: "needLogin" });
    expect(toogleUserFlow).toHaveBeenCalledWith(true);
    expect(sessionStorage.getItem("pendingCoupon")).toBe("K7QX9MPLA2");
    expect(redeemCoupon).not.toHaveBeenCalled();

    isLogged = true;
    rerender();

    await waitFor(() => expect(result.current.state.kind).toBe("done"));
    expect(toogleUserFlow).toHaveBeenLastCalledWith(false);
    expect(sessionStorage.getItem("pendingCoupon")).toBeNull();
    expect(redeemCoupon).toHaveBeenCalledTimes(1);
  });

  it("picks up a code stashed before a sign-in that left the page", async () => {
    sessionStorage.setItem("pendingCoupon", "STASHED42");
    renderHook(useCouponServices, { wrapper: wrapper("/coupon") });

    await waitFor(() => expect(redeemCoupon).toHaveBeenCalledWith("STASHED42"));
  });

  it("redeems a typed code, and a typed code waits for the sign-in like a linked one", async () => {
    const { result } = renderHook(useCouponServices, { wrapper: wrapper("/coupon") });
    act(() => result.current.setCode("  typed-1 "));
    await act(async () => result.current.submit({ preventDefault: () => undefined } as React.FormEvent));
    expect(redeemCoupon).toHaveBeenCalledWith("typed-1");

    isLogged = false;
    const out = renderHook(useCouponServices, { wrapper: wrapper("/coupon") });
    act(() => out.result.current.setCode("TYPED2"));
    act(() => out.result.current.submit({ preventDefault: () => undefined } as React.FormEvent));
    expect(out.result.current.state).toEqual({ kind: "needLogin" });
    isLogged = true;
    out.rerender();
    await waitFor(() => expect(redeemCoupon).toHaveBeenCalledWith("TYPED2"));
  });

  it("says why a code paid nothing, and hands an account lock to the verify flow", async () => {
    redeemCoupon.mockRejectedValue(fail("usedUp"));
    const { result } = renderHook(useCouponServices, { wrapper: wrapper("/coupon/K7QX9MPLA2") });

    await waitFor(() => expect(result.current.state).toEqual({ kind: "failed", problem: "usedUp" }));
    expect(handleAccountLock).toHaveBeenCalledWith(expect.anything(), "coupon");
    expect(problemOf(fail("verify"))).toBe("verify");
    expect(problemOf(fail("something new"))).toBe("retry");
    expect(problemOf(new Error("offline"))).toBe("retry");
  });
});
