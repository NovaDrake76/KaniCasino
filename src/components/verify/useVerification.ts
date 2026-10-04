import { useContext } from "react";
import UserContext from "../../UserContext";
import type { Verification } from "../../services/account/AccountService";
import i18n from "../../i18n";

export interface VerifyState {
  // signed in and not verified yet
  needed: boolean;
  // the gated features already need it, rather than only warning
  enforced: boolean;
  from: Date | null;
}

export const useVerification = (): VerifyState => {
  const userData = useContext(UserContext)?.userData;
  const v: Verification | undefined = userData?.verification;
  if (!v || v.verified) return { needed: false, enforced: false, from: null };
  const from = new Date(v.requiredFrom);
  return { needed: true, enforced: v.enforced || Date.now() >= from.getTime(), from };
};

export const lockDate = (from: Date) =>
  new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long" }).format(from);
