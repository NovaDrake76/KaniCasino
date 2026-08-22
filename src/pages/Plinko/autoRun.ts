// what one tick of an auto run should do. pulled out of the hook so the pacing rules are
// a pure function: this is the part that decides whether a hundred-ball run finishes.
export type AutoStep = "fire" | "wait" | "done" | "broke";

// what a finished drop request means for the run. a refusal the server calls retryable is
// the board being busy, not the player being out of money, so it costs a tick and no ball.
export type DropOutcome = "ok" | "retry" | "stop";

// 503 is the server saying it lost a race with another drop; 429 is its own rate limit.
// both clear on their own, so neither should end a hundred-ball run.
export const outcomeFor = (status?: number): DropOutcome =>
  status === 503 || status === 429 ? "retry" : "stop";

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
