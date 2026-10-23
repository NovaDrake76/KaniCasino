// what one tick of an auto run should do. pulled out of the hook so the pacing rules are
// a pure function: this is the part that decides whether a hundred-ball run finishes.
export type AutoStep = "fire" | "wait" | "done" | "broke";

// what a finished drop request means for the run. a refusal the server calls retryable is
// the board being busy, not the player being out of money, so it costs a tick and no ball.
export type DropOutcome = "ok" | "retry" | "busy" | "stop";

// 503 is the server saying it lost a race with another drop, which clears at once; 429 is the player's bet line being full or
// a limit, where asking again every second only adds to the pile. neither should end a hundred-ball run.
export const outcomeFor = (status?: number): DropOutcome =>
  status === 503 ? "retry" : status === 429 ? "busy" : "stop";

// how long a run holds off after refusals in a row: a second, doubling, never past fifteen
export const backoffMs = (refusals: number) => Math.min(15000, 1000 * 2 ** Math.max(0, refusals - 1));

export interface AutoState {
  left: number;
  inFlight: number;
  available: number;
  bet: number;
  maxInFlight: number;
}

export const autoStep = ({ left, inFlight, available, bet, maxInFlight }: AutoState): AutoStep => {
  // a ball still in the air may yet come back needing another try, so the run is only
  // finished once the board is clear as well as the count
  if (left <= 0) return inFlight > 0 ? "wait" : "done";
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
