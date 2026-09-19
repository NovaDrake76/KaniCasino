import api from "../api";

// the features her shop opens; the boosts and charms have no gate of their own, so they are not here
export type UnlockKey =
  | "chatPass"
  | "tradersLicense"
  | "collectionBook"
  | "affiliateCard"
  | "predictionPass"
  | "giftCharm"
  | "merchantSeal"
  | "goldenTicket"
  | "rainCoat";

// an unlock opens a feature, a boost adds to the xp every bet earns, a charm adds to it on one game
export type ItemKind = "unlock" | "boost" | "charm";

export interface ShopItem {
  key: string;
  kind: ItemKind;
  price: number;
  level: number;
  // a boost's or a charm's share of extra xp, and the game a charm is for
  xp?: number;
  game?: string;
  owned: boolean;
  // how an owned item came: bought in her shop, or kept from what the account had already done
  via: "bought" | "history" | null;
}

// the account's xp multipliers: `all` for every bet, a game key for its charm
export interface XpBoost {
  all?: number;
  [game: string]: number | undefined;
}

export interface Shop {
  // what the shelf shows: everything held, the next few on each ladder and every charm; hidden counts the rest per ladder
  items: ShopItem[];
  hidden?: { unlock: number; boost: number };
  xpBoost?: XpBoost;
  walletBalance: number;
  level: number;
}

export interface ShopPurchase {
  bought: boolean;
  alreadyOwned?: boolean;
  key: string;
  walletBalance?: number;
  unlocks: string[];
  xpBoost?: XpBoost;
  shop: Shop;
}

export async function getShop(): Promise<Shop> {
  const res = await api.get("/daisu/shop");
  return res.data;
}

export async function buyShopItem(key: string): Promise<ShopPurchase> {
  const res = await api.post(`/daisu/shop/${key}/buy`);
  return res.data;
}
