import { useContext, useEffect, useState } from "react";
import UserContext from "../../UserContext";
import { GIFT_CLAIMED_EVENT, GiftStatus, getGiftStatus } from "../../services/gift/GiftService";

const IDLE: GiftStatus = { canSpin: false, nextAt: null, streak: 0, nextStreak: 1, keepsStreak: false };

// the navbar, the sidebar and the floating prompt all want the same answer, so they share
// one request and one timer rather than each polling the endpoint on their own
let current: GiftStatus = IDLE;
// whose answer the store is holding. without it a new mount reads back the previous
// account's status and shows the prompt for a spin that is not theirs, until the fetch
// lands. it is also what stops one test leaking its state into the next.
let owner: string | null = null;
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
  // only trust the store when it is this account's answer
  const [status, setStatus] = useState<GiftStatus>(() =>
    owner && owner === userData?.id ? current : IDLE
  );

  useEffect(() => {
    if (!userData?.id) {
      owner = null;
      publish(IDLE);
      return;
    }
    if (owner !== userData.id) {
      owner = userData.id;
      publish(IDLE);
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
