import { useEffect, useState } from "react";
import { splitRemaining } from "../../Leaderboard/Leaderboard.services";
import { ClockProps } from "./Clock.types";

export const clockText = (ms: number) => {
  const { hours, minutes, seconds } = splitRemaining(ms);
  return `${hours}:${minutes}:${seconds}`;
};

// the one-second tick lives in the span it changes, so a passing second re-renders nothing else on the home page
export const useClock = ({ endsAt, skew }: ClockProps) => {
  const [text, setText] = useState(() => clockText(endsAt - (Date.now() - skew)));

  useEffect(() => {
    const tick = () => setText(clockText(endsAt - (Date.now() - skew)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt, skew]);

  return { text };
};
