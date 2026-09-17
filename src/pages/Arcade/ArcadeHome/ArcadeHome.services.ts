import { useContext, useEffect, useState } from "react";
import UserContext from "../../../UserContext";
import { getHaloToday, HaloToday } from "../../../services/arcade/DailyHaloService";
import { countdown } from "../DailyHalo/dailyHalo.logic";

export type HaloStatus = "solved" | "missed" | "playing" | "new";

export const haloStatus = (today: HaloToday | null): HaloStatus => {
  const play = today?.play;
  if (!play || play.guesses.length === 0) return "new";
  if (play.won) return "solved";
  if (play.finished) return "missed";
  return "playing";
};

export const useArcadeHome = () => {
  const { userData } = useContext(UserContext);
  const [today, setToday] = useState<HaloToday | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    getHaloToday()
      .then((t) => {
        if (active) setToday(t);
      })
      .catch(() => {
        // the card still links to the game without today's numbers
      });
    return () => {
      active = false;
    };
  }, [userData?.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return {
    loaded: !!today,
    number: today?.number ?? null,
    clock: today ? countdown(new Date(today.nextAt).getTime() - now) : null,
    solves: today?.solves ?? 0,
    status: haloStatus(today),
    bestReward: today?.reward.best ?? null,
  };
};
