// A game page raises this while the player has money riding on a round in progress.
// Anything that would pull them off the page, like the mission-complete toast, waits
// for it to clear instead of inviting a click mid-round.
let atRisk = false;
let waiting: (() => void)[] = [];

export const setStakeAtRisk = (value: boolean) => {
  if (atRisk === value) return;
  atRisk = value;
  if (!atRisk) {
    const queued = waiting;
    waiting = [];
    queued.forEach((run) => run());
  }
};

export const isStakeAtRisk = () => atRisk;

export const whenStakeClears = (run: () => void) => {
  if (atRisk) waiting.push(run);
  else run();
};
