import { useEffect, useState } from "react";
import type { PotStatus } from "../../services/daisu/DaisuService";

// the dock and the games' bonus strip read the same pot. only the dock fetches it; the games
// just listen, so a game page never adds a request of its own
let current: PotStatus | null = null;
const listeners = new Set<(s: PotStatus | null) => void>();

export const setPotStatus = (next: PotStatus | null) => {
  current = next;
  listeners.forEach((fn) => fn(next));
};

export const usePotStatus = (): PotStatus | null => {
  const [status, setStatus] = useState<PotStatus | null>(current);

  useEffect(() => {
    listeners.add(setStatus);
    setStatus(current);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);

  return status;
};
