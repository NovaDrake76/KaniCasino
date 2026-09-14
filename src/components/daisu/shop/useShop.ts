import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { buyShopItem, ShopPurchase, UnlockKey } from "../../../services/daisu/ShopService";
import { loadShop, setShop, useShopState } from "./shopStore";
import i18n from "../../../i18n";

interface Args {
  live: boolean;
  userId?: string;
  // her room is open on the shop tab
  open: boolean;
  onBought: (purchase: ShopPurchase) => void;
}

// her shop: read when its tab opens, one item picked to look at, and a purchase that ends on what it opened
export const useShop = ({ live, userId, open, onBought }: Args) => {
  const shop = useShopState();
  const [picked, setPicked] = useState<UnlockKey | null>(null);
  const [buying, setBuying] = useState(false);
  const [unlocked, setUnlocked] = useState<UnlockKey | null>(null);

  // an account never sees the shop of whoever was signed in before
  useEffect(() => {
    setShop(null);
    setPicked(null);
    setUnlocked(null);
  }, [userId]);

  useEffect(() => {
    if (live && open) loadShop(true);
  }, [live, open]);

  const pickItem = (key: UnlockKey) => {
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
      const e = err as { response?: { data?: { message?: string } } };
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
