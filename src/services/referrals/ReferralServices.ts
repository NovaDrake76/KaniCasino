import api from "../api";

export interface ReferralRow {
  id: string;
  username: string;
  profilePicture: string;
  joinedAt: string;
  wagered: number;
  commission: number;
  active: boolean;
}

export interface ReferralDashboard {
  referralCode: string | null;
  signupBonus: number;
  commissionRate: number;
  totals: {
    earned: number;
    claimed: number;
    available: number;
    totalWagered: number;
    referralCount: number;
    activeCount: number;
  };
  referrals: ReferralRow[];
}

export const getReferralDashboard = async (): Promise<ReferralDashboard> => {
  const response = await api.get("/referrals/me");
  return response.data;
};

export const createReferralCode = async (code: string): Promise<{ referralCode: string }> => {
  const response = await api.post("/referrals/code", { code });
  return response.data;
};

export const claimReferralEarnings = async (): Promise<{ claimed: number; walletBalance: number }> => {
  const response = await api.post("/referrals/claim");
  return response.data;
};

// the code captured from a /r/<code> visit, held until a registration consumes it
const PENDING_KEY = "pendingReferralCode";

export const setPendingReferralCode = (code: string) =>
  localStorage.setItem(PENDING_KEY, code.toUpperCase());

export const getPendingReferralCode = (): string =>
  localStorage.getItem(PENDING_KEY) || "";

export const clearPendingReferralCode = () => localStorage.removeItem(PENDING_KEY);
