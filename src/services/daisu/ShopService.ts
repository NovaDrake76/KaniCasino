import api from "../api";

export type UnlockKey = "collectionBook" | "tradersLicense" | "chatPass" | "predictionPass";

export interface ShopItem {
  key: UnlockKey;
  price: number;
  level: number;
  owned: boolean;
  // how an owned item came: bought in her shop, or kept from what the account had already done
  via: "bought" | "history" | null;
}

export interface Shop {
  items: ShopItem[];
  walletBalance: number;
  level: number;
}

export interface ShopPurchase {
  bought: boolean;
  alreadyOwned?: boolean;
  key: UnlockKey;
  walletBalance?: number;
  unlocks: UnlockKey[];
  shop: Shop;
}

export async function getShop(): Promise<Shop> {
  const res = await api.get("/daisu/shop");
  return res.data;
}

export async function buyShopItem(key: UnlockKey): Promise<ShopPurchase> {
  const res = await api.post(`/daisu/shop/${key}/buy`);
  return res.data;
}
