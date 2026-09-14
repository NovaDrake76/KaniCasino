import { useEffect, useState } from "react";
import { usePotStatus } from "./potStore";
import { EXPIRING_MS } from "./potMath";
import type { PickGame } from "../../services/daisu/DaisuService";

// the live bonus daisu put on this game, ticking down, or null when there is none to spend
export const useGameBonus = (game: PickGame) => {
  const status = usePotStatus();
  const bonus = status?.bonuses.find((b) => b.game === game && !b.expired && b.amount > 0);
  const expiresAt = bonus?.expiresAt ? Date.parse(bonus.expiresAt) : 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const msLeft = expiresAt - now;
  if (!bonus || msLeft <= 0) return null;
  return {
    amount: bonus.amount,
    msLeft,
    left: Math.min(1, msLeft / (status?.creditTtlMs || msLeft)),
    expiring: msLeft <= EXPIRING_MS,
  };
};

export default useGameBonus;
