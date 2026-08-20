import api from "../api";

export type BadgeKey = "topFan" | "contributor" | "connected";

export interface BadgeFandom {
  name: string;
  image: string;
  rarity: string;
  count: number;
  fans: number;
}

export interface Badge {
  key: BadgeKey;
  awardedAt: string | null;
  note?: string | null;
  fandom?: BadgeFandom;
}

export interface BadgeChoice {
  selectedBadge: BadgeKey | null;
  badge: Badge | null;
}

export async function setWornBadge(badge: BadgeKey | null): Promise<BadgeChoice> {
  const res = await api.put("/users/badge", { badge });
  return res.data;
}

export async function grantBadge(
  userId: string,
  key: BadgeKey,
  note: string,
  action: "grant" | "revoke"
): Promise<{ badges: Badge[] }> {
  const res = await api.put(`/admin/users/${userId}/badge`, { key, note, action });
  return res.data;
}
