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

let configured = false;

// the placement api preloads the first break the moment it is configured, so this has to
// run at startup: calling it immediately before adBreak leaves nothing preloaded and the
// break comes back empty. safe to call more than once, it only acts the first time.
export const initAdPlacement = async () => {
  if (configured) return;
  if (!(await waitForAdBreak())) return;
  configured = true;
  window.adConfig?.({ preloadAdBreaks: "on", sound: "on" });
};

export const showRewardedAd = async (handlers: {
  onGranted: () => void;
  onDismissed: () => void;
  // breakStatus is the placement api's own reason: noAdPreloaded, frequencyCapped,
  // notReady, timeout, error, ignored, other. without it a no-fill and a broken
  // integration look identical from here, which is exactly the hole this filled.
  onUnavailable: (reason?: string) => void;
}) => {
  const ready = await waitForAdBreak();
  if (!ready) {
    // adsbygoogle is the display-slot queue: it swallows a reward request without calling back
    handlers.onUnavailable("scriptMissing");
    return;
  }

  // normally already done at startup; this only matters if the script arrived late
  await initAdPlacement();

  let shown = false;
  let settled = false;
  const once = (fn: () => void) => () => {
    if (settled) return;
    settled = true;
    fn();
  };
  const unavailable = (reason?: string) => {
    if (settled) return;
    settled = true;
    handlers.onUnavailable(reason);
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
    adBreakDone: (info: { breakStatus?: string } = {}) => {
      // no fill: beforeReward never ran, so nothing was ever shown
      if (!shown) unavailable(info.breakStatus || "unknown");
    },
  });
};
