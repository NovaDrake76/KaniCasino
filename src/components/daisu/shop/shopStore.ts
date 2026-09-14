import { useEffect, useState } from "react";
import { getShop, Shop } from "../../../services/daisu/ShopService";

// her room and every locked page read the same shop, so one request serves them all until a
// purchase hands back a fresh one
let current: Shop | null = null;
let pending: Promise<Shop | null> | null = null;
const listeners = new Set<(s: Shop | null) => void>();

export const setShop = (next: Shop | null) => {
  current = next;
  listeners.forEach((fn) => fn(next));
};

export const loadShop = (fresh = false): Promise<Shop | null> => {
  if (current && !fresh) return Promise.resolve(current);
  if (!pending) {
    pending = getShop()
      .then((shop) => {
        setShop(shop);
        return shop;
      })
      .catch(() => null)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
};

export const useShopState = (): Shop | null => {
  const [shop, setState] = useState<Shop | null>(current);

  useEffect(() => {
    listeners.add(setState);
    setState(current);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return shop;
};
