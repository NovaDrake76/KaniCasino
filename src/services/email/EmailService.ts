import api from "../api";

export interface EmailPreferences {
  marketingOptIn: boolean;
  emailSuppressed: boolean;
}

export const getEmailPreferences = async (): Promise<EmailPreferences> =>
  (await api.get("/email/preferences")).data;

export const setMarketingOptIn = async (marketingOptIn: boolean): Promise<EmailPreferences> =>
  (await api.put("/email/preferences", { marketingOptIn })).data;

// the unsubscribe link carries its own credential, so this works logged out
export const unsubscribeByToken = async (u: string, t: string) =>
  (await api.post(`/email/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`)).data;
