import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { buyShopItem, ShopPurchase } from "../../../services/daisu/ShopService";
import { loadShop, setShop, useShopState } from "./shopStore";
import { statusOf } from "./shopCopy";
import { track } from "../../../services/usage/usage";
import i18n from "../../../i18n";

interface Args {
  live: boolean;
  userId?: string;
  // her room is open on the shop tab
  open: boolean;
  // what the player holds right now, which the socket keeps current
  walletBalance?: number;
  level?: number;
  onBought: (purchase: ShopPurchase) => void;
}

// her shop: read when its tab opens, one item picked to look at, and a purchase that ends on what it opened
export const useShop = ({ live, userId, open, walletBalance, level, onBought }: Args) => {
  const held = useShopState();
  // the shop is read once when its tab opens, so its own copy of the wallet goes stale the
  // moment the jar is taken beside it. price against what the player is actually holding
  const shop = held && { ...held, walletBalance: walletBalance ?? held.walletBalance, level: level ?? held.level };
  const [picked, setPicked] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [unlocked, setUnlocked] = useState<string | null>(null);

  // an account never sees the shop of whoever was signed in before
  useEffect(() => {
    setShop(null);
    setPicked(null);
    setUnlocked(null);
  }, [userId]);

  useEffect(() => {
    if (live && open) loadShop(true);
  }, [live, open]);

  // the state is what the slot said when it was clicked: an item looked at and not bought is read against it
  const pickItem = (key: string, via = "shelf") => {
    const item = shop?.items.find((i) => i.key === key);
    track("shop_item", { item: key, via, state: item && shop ? statusOf(item, shop).state : "unknown" });
    setPicked(key);
    if (live) loadShop();
  };

  const buy = async () => {
    if (!picked || buying) return;
    setBuying(true);
    try {
      const res = await buyShopItem(picked);
      setShop(res.shop);
      setPicked(null);
      if (res.bought) {
        onBought(res);
        setUnlocked(res.key);
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string; reason?: string } } };
      track("shop_buy_failed", { item: picked, status: e?.response?.status ?? 0, reason: e?.response?.data?.reason });
      toast.error(e?.response?.data?.message || i18n.t("daisu.shop.failed"), { theme: "dark" });
      loadShop(true);
    } finally {
      setBuying(false);
    }
  };

  return {
    shop,
    pickedItem: (picked && shop?.items.find((item) => item.key === picked)) || null,
    pickItem,
    closePick: () => setPicked(null),
    buying,
    buy,
    unlocked,
    closeUnlocked: () => setUnlocked(null),
  };
};
