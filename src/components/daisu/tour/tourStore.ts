import { useEffect, useState } from "react";
import { saveTour, TourStatus, TourStep } from "../../../services/daisu/DaisuService";
import type { GameResult, RevealedItem } from "./tourEvents";

export interface TourState {
  owner: string | null;
  status: TourStatus | null;
  step: TourStep | null;
  // what only this tab saw, so a reload skips the steps that needed it
  game: string | null;
  drop: RevealedItem | null;
  result: GameResult | null;
}

const EMPTY: TourState = { owner: null, status: null, step: null, game: null, drop: null, result: null };

// outside the react tree: the app remounts on a language change, and the tour must not restart
let state: TourState = EMPTY;
const listeners = new Set<(s: TourState) => void>();

const publish = (next: Partial<TourState>) => {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn(state));
};

// best-effort: the tour carries on in this tab even when a save does not land
const persist = (status: TourStatus, step?: TourStep) => {
  saveTour(status, step).catch(() => undefined);
};

// the server's word is taken once per account; after that this tab is ahead of it
export const syncTour = (owner: string | null, onboarding: { status: TourStatus; step: string | null } | null | undefined) => {
  if (owner === state.owner && state.status) return;
  publish({
    ...EMPTY,
    owner,
    status: onboarding ? onboarding.status : null,
    step: onboarding ? (onboarding.step as TourStep | null) : null,
  });
};

export const startTour = () => {
  publish({ status: "active", step: "pot" });
  persist("active", "pot");
};

export const goTo = (step: TourStep, extra: Partial<TourState> = {}) => {
  publish({ ...extra, step });
  persist(step === "done" ? "done" : "active", step);
};

export const endTour = () => {
  const running = state.status === "offered" || state.status === "active";
  publish({ status: "skipped", step: null });
  if (running) persist("skipped");
};

// the closing card was read; the server already has the tour as done
export const finishTour = () => publish({ status: "done", step: null });

export const tourState = () => state;

export const useTour = (): TourState => {
  const [current, setCurrent] = useState<TourState>(state);

  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(state);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);

  return current;
};
