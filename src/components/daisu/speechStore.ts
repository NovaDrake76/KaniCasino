import { useSyncExternalStore } from "react";

// how many lines are typing themselves out right now. her mouth moves while any of them
// is, which is what ties the drawing to the words without either one knowing the other
let typing = 0;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((fn) => fn());

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const talking = () => typing > 0;

export const speech = {
  start: () => {
    typing += 1;
    tell();
  },
  stop: () => {
    typing = Math.max(0, typing - 1);
    tell();
  },
};

export const useTalking = () => useSyncExternalStore(subscribe, talking, talking);
