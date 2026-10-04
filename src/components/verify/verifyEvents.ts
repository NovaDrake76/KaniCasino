import { toast } from "react-toastify";
import i18n from "../../i18n";

export const VERIFY_OPEN_EVENT = "verify:open";

// every screen that runs into the lock opens the same panel
export const openVerify = () => window.dispatchEvent(new CustomEvent(VERIFY_OPEN_EVENT));

export type VerifyFeature = "leaderboard" | "market" | "rain" | "license";

// a request the server turned down for want of a verified account: say so and offer the way through
export const handleVerifyLock = (err: unknown, feature: VerifyFeature): boolean => {
  const reason = (err as { response?: { data?: { reason?: string } } })?.response?.data?.reason;
  if (reason !== "verify") return false;
  toast.info(i18n.t(`verify.locked.${feature}`), { theme: "dark" });
  openVerify();
  return true;
};
