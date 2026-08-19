import { useContext, useEffect, useState } from "react";
import UserContext from "../../UserContext";
import { GIFT_CLAIMED_EVENT, getGiftStatus } from "../../services/gift/GiftService";

// whether a daily gift is waiting, so the nav can flag it without every page asking.
// it goes dark the moment the gift is claimed and lights up again when the cooldown ends.
export const useGiftReady = (): boolean => {
  const { userData } = useContext(UserContext);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userData?.id) return setReady(false);

    let timer: ReturnType<typeof setTimeout>;
    const check = () =>
      getGiftStatus()
        .then((s) => {
          setReady(s.canSpin);
          const wait = s.nextAt ? new Date(s.nextAt).getTime() - Date.now() : 0;
          if (!s.canSpin && wait > 0) timer = setTimeout(check, wait + 1000);
        })
        .catch(() => setReady(false));

    const claimed = () => setReady(false);
    window.addEventListener(GIFT_CLAIMED_EVENT, claimed);
    check();

    return () => {
      window.removeEventListener(GIFT_CLAIMED_EVENT, claimed);
      clearTimeout(timer);
    };
  }, [userData?.id]);

  return ready;
};

export default useGiftReady;
