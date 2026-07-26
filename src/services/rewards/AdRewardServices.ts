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

// a no-fill must not spend one of the day's tries
export const abandonAdWatch = async (token: string): Promise<void> => {
  try {
    await api.post("/rewards/ads/abandon", { token });
  } catch {
    // best effort: the token expires with the day anyway
  }
};

// the adsense tag loads after the page, so adBreak can be late or never arrive at all
declare global {
  interface Window {
    adsbygoogle: unknown[];
    adBreak?: (o: Record<string, unknown>) => void;
    adConfig?: (o: Record<string, unknown>) => void;
  }
}

const AD_SCRIPT_WAIT_MS = 6000;

// resolves once the placement api is live, or false if it never turns up
const waitForAdBreak = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (typeof window.adBreak === "function") return resolve(true);
    const started = Date.now();
    const tick = window.setInterval(() => {
      if (typeof window.adBreak === "function") {
        window.clearInterval(tick);
        resolve(true);
      } else if (Date.now() - started > AD_SCRIPT_WAIT_MS) {
        window.clearInterval(tick);
        resolve(false);
      }
    }, 200);
  });

export const showRewardedAd = async (handlers: {
  onGranted: () => void;
  onDismissed: () => void;
  onUnavailable: () => void;
}) => {
  const ready = await waitForAdBreak();
  if (!ready) {
    // adsbygoogle is the display-slot queue: it swallows a reward request without calling back
    handlers.onUnavailable();
    return;
  }

  // the placement api wants its config before the first break is requested
  window.adConfig?.({ preloadAdBreaks: "on", sound: "on" });

  let shown = false;
  let settled = false;
  const once = (fn: () => void) => () => {
    if (settled) return;
    settled = true;
    fn();
  };

  window.adBreak?.({
    type: "reward",
    name: "kp-reward",
    beforeReward: (showAdFn: () => void) => {
      shown = true;
      showAdFn();
    },
    adViewed: once(handlers.onGranted),
    adDismissed: once(handlers.onDismissed),
    adBreakDone: () => {
      // no fill: beforeReward never ran, so nothing was ever shown
      if (!shown) once(handlers.onUnavailable)();
    },
  });
};
