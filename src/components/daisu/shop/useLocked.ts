import { useContext } from "react";
import UserContext from "../../../UserContext";
import type { UnlockKey } from "../../../services/daisu/ShopService";

// a feature is shut only for an account in her beta that has not unlocked it; everyone else keeps
// the rules the site always had
export const useLocked = (key: UnlockKey): boolean => {
  const userData = useContext(UserContext)?.userData;
  return !!userData?.features?.daisu && Array.isArray(userData.unlocks) && !userData.unlocks.includes(key);
};
