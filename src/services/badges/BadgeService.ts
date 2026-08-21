import api from "../api";

// a collection badge is keyed off its category slug, so the set is open-ended
export type BadgeKey = "topFan" | "contributor" | "connected" | `collection:${string}`;

export const COLLECTION_PREFIX = "collection:";
export const isCollectionBadge = (key: string) => key.startsWith(COLLECTION_PREFIX);

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
  // the category name behind a collection badge
  label?: string | null;
  fandom?: BadgeFandom;
}

export interface CatalogBadge {
  key: BadgeKey;
  label: string | null;
  size?: number;
}

export async function getBadgeCatalog(): Promise<CatalogBadge[]> {
  const res = await api.get("/users/badges/catalog");
  return res.data.badges || [];
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
