import { useState } from "react";
import { useHeld } from "../../components/daisu/shop/useLocked";

const KEY = "kani.skipCaseAnimation";

export const readSkip = (): boolean => {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export const writeSkip = (on: boolean) => {
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // storage blocked: the switch still works, it just does not survive a reload
  }
};

// the stopwatch from her shop; a choice stored in this browser does nothing for an account that does not hold it
export const useSkipAnimation = () => {
  const held = useHeld("stopwatch");
  const [on, setOn] = useState(readSkip);
  const set = (next: boolean) => {
    setOn(next);
    writeSkip(next);
  };
  return { held, on, set, skip: held && on };
};
