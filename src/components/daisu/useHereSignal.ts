import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { sayHere } from "../../services/daisu/DaisuService";

// her "still there?" waits for half an hour without a sign of the player, so one sign every few minutes is plenty
export const HERE_EVERY_MS = 5 * 60 * 1000;
const INPUTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
// a click on the jar is what a macro does, and the answer to her question is its own request
const NOT_HERE = '[data-tour="daisu-jar"], [data-still-there]';

// a script's synthetic clicks are not trusted events, so they never count
export const countsAsHere = (e: Pick<Event, "isTrusted" | "target">) =>
  e.isTrusted && !(e.target instanceof Element && e.target.closest(NOT_HERE));

// real input anywhere else on the page, or moving to another page, tells the server a person is here
export const useHereSignal = (enabled: boolean) => {
  const lastSent = useRef(0);
  const { pathname } = useLocation();

  const signal = useRef(() => {
    if (Date.now() - lastSent.current < HERE_EVERY_MS) return;
    lastSent.current = Date.now();
    sayHere().catch(() => undefined);
  });

  useEffect(() => {
    if (!enabled) return;
    const onInput = (e: Event) => {
      if (countsAsHere(e)) signal.current();
    };
    for (const type of INPUTS) window.addEventListener(type, onInput, { capture: true, passive: true });
    return () => {
      for (const type of INPUTS) window.removeEventListener(type, onInput, { capture: true });
    };
  }, [enabled]);

  useEffect(() => {
    if (enabled) signal.current();
  }, [enabled, pathname]);
};
