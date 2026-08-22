// what one tick of an auto run should do. pulled out of the hook so the pacing rules are
// a pure function: this is the part that decides whether a hundred-ball run finishes.
export type AutoStep = "fire" | "wait" | "done" | "broke";

export interface AutoState {
  left: number;
  inFlight: number;
  available: number;
  bet: number;
  maxInFlight: number;
}

export const autoStep = ({ left, inFlight, available, bet, maxInFlight }: AutoState): AutoStep => {
  if (left <= 0) return "done";
  // the board is full: skip this tick without spending a ball, so the run paces itself
  // against how fast balls actually land rather than against a fixed timer
  if (inFlight >= maxInFlight) return "wait";
  if (available < bet) {
    // a ball still falling may yet pay for this one, so being short is only fatal once
    // nothing is left in the air
    return inFlight > 0 ? "wait" : "broke";
  }
  return "fire";
};
