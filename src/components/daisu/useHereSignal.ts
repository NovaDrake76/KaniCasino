import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { sayHere } from "../../services/daisu/DaisuService";

// her "still there?" waits for half an hour without a sign of the player, so one sign every few minutes is plenty
export const HERE_EVERY_MS = 5 * 60 * 1000;
const INPUTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
// a click on the jar is what a macro does, and the answer to her question is its own request
const NOT_HERE = '[data-tour="daisu-jar"], [data-still-there]';

let lastUser: string | undefined;
let lastSent = 0;
let landed: Promise<void> = Promise.resolve();

// one sign every few minutes at most, per account. it settles once the server has it, so the pot can be read after it:
// read first, a player who has just opened the site was taken for one who walked away
export const signalHere = (userId?: string): Promise<void> => {
  if (userId === lastUser && Date.now() - lastSent < HERE_EVERY_MS) return landed;
  lastUser = userId;
  lastSent = Date.now();
  landed = sayHere().catch(() => undefined);
  return landed;
};

// for tests, which share one module instance
export const resetHere = () => {
  lastUser = undefined;
  lastSent = 0;
  landed = Promise.resolve();
};

// a script's synthetic clicks are not trusted events, so they never count
export const countsAsHere = (e: Pick<Event, "isTrusted" | "target">) =>
  e.isTrusted && !(e.target instanceof Element && e.target.closest(NOT_HERE));

// real input anywhere else on the page, or moving to another page, tells the server a person is here
export const useHereSignal = (enabled: boolean, userId?: string) => {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!enabled) return;
    const onInput = (e: Event) => {
      if (countsAsHere(e)) signalHere(userId);
    };
    for (const type of INPUTS) window.addEventListener(type, onInput, { capture: true, passive: true });
    return () => {
      for (const type of INPUTS) window.removeEventListener(type, onInput, { capture: true });
    };
  }, [enabled, userId]);

  useEffect(() => {
    if (enabled) signalHere(userId);
  }, [enabled, userId, pathname]);
};
