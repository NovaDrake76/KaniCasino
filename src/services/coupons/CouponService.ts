import api from "../api";

export interface CouponRedeemed {
  redeemed: boolean;
  amount: number;
  walletBalance: number;
}

export async function redeemCoupon(code: string): Promise<CouponRedeemed> {
  const res = await api.post("/coupons/redeem", { code });
  return res.data;
}

// a code from a link waits here while its visitor signs in, in case the sign-in leaves the page
const PENDING = "pendingCoupon";

export const setPendingCoupon = (code: string) => {
  try {
    sessionStorage.setItem(PENDING, code);
  } catch {
    // a private window can refuse storage; the code is still in the url
  }
};

export const takePendingCoupon = (): string | null => {
  try {
    const code = sessionStorage.getItem(PENDING);
    if (code) sessionStorage.removeItem(PENDING);
    return code;
  } catch {
    return null;
  }
};
