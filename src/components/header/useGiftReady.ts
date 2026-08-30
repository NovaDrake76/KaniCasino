import { useContext, useEffect, useState } from "react";
import UserContext from "../../UserContext";
import { GIFT_CLAIMED_EVENT, GiftStatus, getGiftStatus } from "../../services/gift/GiftService";

const IDLE: GiftStatus = { canSpin: false, nextAt: null, streak: 0, nextStreak: 1, keepsStreak: false };

// the navbar, the sidebar and the floating prompt all want the same answer, so they share
// one request and one timer rather than each polling the endpoint on their own
let current: GiftStatus = IDLE;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(s: GiftStatus) => void>();

const publish = (next: GiftStatus) => {
  current = next;
  listeners.forEach((fn) => fn(next));
};

const check = () => {
  if (timer) clearTimeout(timer);
  getGiftStatus()
    .then((s) => {
      publish(s);
      // wake up exactly when the cooldown ends, so the prompt appears without a reload
      const wait = s.nextAt ? new Date(s.nextAt).getTime() - Date.now() : 0;
      if (!s.canSpin && wait > 0) timer = setTimeout(check, wait + 1000);
    })
    .catch(() => publish(IDLE));
};

// the spin is claimed: go dark now, then reconcile with the server for the new streak
const onClaimed = () => {
  publish({ ...current, canSpin: false });
  check();
};

export const useGiftStatus = (): GiftStatus => {
  const { userData } = useContext(UserContext);
  const [status, setStatus] = useState<GiftStatus>(current);

  useEffect(() => {
    if (!userData?.id) {
      publish(IDLE);
      return;
    }
    listeners.add(setStatus);
    if (listeners.size === 1) window.addEventListener(GIFT_CLAIMED_EVENT, onClaimed);
    check();

    return () => {
      listeners.delete(setStatus);
      if (!listeners.size) {
        window.removeEventListener(GIFT_CLAIMED_EVENT, onClaimed);
        if (timer) clearTimeout(timer);
      }
    };
  }, [userData?.id]);

  return status;
};

export const useGiftReady = (): boolean => useGiftStatus().canSpin;

export default useGiftReady;
