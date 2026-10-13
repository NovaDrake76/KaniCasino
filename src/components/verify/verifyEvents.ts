import { toast } from "react-toastify";
import i18n from "../../i18n";

export const VERIFY_OPEN_EVENT = "verify:open";

// every screen that runs into the lock opens the same panel
export const openVerify = () => window.dispatchEvent(new CustomEvent(VERIFY_OPEN_EVENT));

export type VerifyFeature = "leaderboard" | "market" | "rain" | "license";

// a request the server turned down because of the account itself: unverified gets the way through, limited gets why
export const handleAccountLock = (err: unknown, feature: VerifyFeature | "referrals"): boolean => {
  const reason = (err as { response?: { data?: { reason?: string } } })?.response?.data?.reason;
  if (reason === "limited") {
    toast.error(i18n.t(`limited.${feature}`), { theme: "dark" });
    return true;
  }
  if (reason !== "verify" || feature === "referrals") return false;
  toast.info(i18n.t(`verify.locked.${feature}`), { theme: "dark" });
  openVerify();
  return true;
};
