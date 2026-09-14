import { useEffect, useState } from "react";

export interface HelpState {
  owner: string | null;
  mission: string | null;
  goal: string | null;
  // the mission's title, in the words it had when she was asked
  title: string;
  step: string | null;
  // the game she walks the player through, once there is one
  game: string | null;
}

const EMPTY: HelpState = { owner: null, mission: null, goal: null, title: "", step: null, game: null };

// outside the react tree like the tour, since the app remounts on a language change
let state: HelpState = EMPTY;
const listeners = new Set<(s: HelpState) => void>();

const publish = (next: HelpState) => {
  state = next;
  listeners.forEach((fn) => fn(state));
};

export const startHelp = (owner: string, mission: string, goal: string, title: string) =>
  publish({ ...EMPTY, owner, mission, goal, title });

export const helpTo = (step: string, extra: Partial<HelpState> = {}) => publish({ ...state, ...extra, step });

export const endHelp = () => publish(EMPTY);

export const helpState = () => state;

export const useHelp = (): HelpState => {
  const [current, setCurrent] = useState<HelpState>(state);

  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(state);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);

  return current;
};
