import api from "../api";
import i18n from "../../i18n";

export interface Verification {
  verified: boolean;
  via: "google" | "email" | "discord" | null;
  email: string | null;
  canChangeEmail: boolean;
  // from this moment the leaderboard, the market and rain need a verified account
  requiredFrom: string;
  enforced: boolean;
}

// why the server would not send or accept a link; the copy for each lives under verify.errors
export type VerifyProblem =
  | "invalid"
  | "noMailServer"
  | "disposable"
  | "taken"
  | "inUse"
  | "same"
  | "google"
  | "password"
  | "bounced"
  | "tooSoon"
  | "expired";

const lang = () => (i18n.language || "en").slice(0, 2);

export const getVerification = async (): Promise<Verification> => (await api.get("/account/verification")).data;

export const sendVerificationEmail = async (): Promise<{ sent?: boolean; to?: string; alreadyVerified?: boolean }> =>
  (await api.post("/account/verify-email", { lang: lang() })).data;

// the link from the email carries its own proof, so this works logged out
export const confirmEmail = async (token: string): Promise<{ verified: boolean; email: string }> =>
  (await api.post("/account/verify-email/confirm", { token })).data;

export const changeEmail = async (email: string, password: string): Promise<{ sent?: boolean; to?: string }> =>
  (await api.put("/account/email", { email, password, lang: lang() })).data;

// the reason a rejected request carries, if any
export const problemOf = (err: unknown): { reason: VerifyProblem | null; suggestion: string | null } => {
  const data = (err as { response?: { data?: { reason?: VerifyProblem; suggestion?: string | null } } })?.response?.data;
  return { reason: data?.reason || null, suggestion: data?.suggestion || null };
};
