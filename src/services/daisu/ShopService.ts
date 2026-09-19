import api from "../api";

export type UnlockKey =
  | "chatPass"
  | "tradersLicense"
  | "collectionBook"
  | "affiliateCard"
  | "predictionPass"
  | "giftCharm"
  | "merchantSeal"
  | "goldenTicket"
  | "rainCoat"
  | "patronBadge"
  | "quickJar"
  | "daisuCrown";

export interface ShopItem {
  key: UnlockKey;
  price: number;
  level: number;
  owned: boolean;
  // how an owned item came: bought in her shop, or kept from what the account had already done
  via: "bought" | "history" | null;
}

export interface Shop {
  // what the shelf shows: everything held and the next few; hidden counts the items still to be revealed by buying
  items: ShopItem[];
  hidden?: number;
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
