import api from "../api";

// when disabled (real-money mode) the api returns only { enabled: false }
export interface AdRewardStatus {
  enabled: boolean;
  provider: "mock" | "adsense";
  amount: number;
  dailyCap: number;
  remainingToday: number;
}

export interface AdWatchStart {
  token: string;
  amount: number;
  minWatchMs: number;
}

export interface AdRewardClaim {
  claimed: number;
  walletBalance: number;
  remainingToday: number;
}

export const getAdRewardStatus = async (): Promise<AdRewardStatus> =>
  (await api.get("/rewards/ads")).data;

export const startAdWatch = async (): Promise<AdWatchStart> =>
  (await api.post("/rewards/ads/start")).data;

export const claimAdReward = async (token: string): Promise<AdRewardClaim> =>
  (await api.post("/rewards/ads/claim", { token })).data;

// google's ad placement api (h5 games ads). the page already loads adsbygoogle, so
// adBreak is just the queued call; this only runs when the provider is "adsense".
declare global {
  interface Window {
    adsbygoogle: unknown[];
    adBreak?: (o: Record<string, unknown>) => void;
  }
}

export const showRewardedAd = (handlers: {
  onGranted: () => void;
  onDismissed: () => void;
  onUnavailable: () => void;
}) => {
  const adBreak =
    window.adBreak || ((o: Record<string, unknown>) => (window.adsbygoogle = window.adsbygoogle || []).push(o));
  let shown = false;
  adBreak({
    type: "reward",
    name: "kp-reward",
    beforeReward: (showAdFn: () => void) => {
      shown = true;
      showAdFn();
    },
    adViewed: () => handlers.onGranted(),
    adDismissed: () => handlers.onDismissed(),
    adBreakDone: () => {
      // no fill: beforeReward never ran, so nothing was ever shown
      if (!shown) handlers.onUnavailable();
    },
  });
};
