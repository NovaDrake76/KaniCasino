const { due, runStart, IDLE_MS, ANSWER_LASTS_MS, BACKSTOP_MS, RUN_GAP_MS } = require("../../utils/stillThere");

const MIN = 60 * 1000;
const NOW = 100 * 24 * 60 * MIN;
const ago = (ms) => new Date(NOW - ms);

describe("daisu's still there?", () => {
  it("leaves a player alone who did something else in the last half hour", () => {
    expect(due({}, NOW - (IDLE_MS - MIN), NOW)).toBe(false);
  });

  it("asks once the player has done nothing but take the pot for half an hour", () => {
    expect(due({}, NOW - (IDLE_MS + MIN), NOW)).toBe(true);
  });

  it("does not ask again within the hour after an answer", () => {
    const user = { stillThereAt: ago(ANSWER_LASTS_MS - MIN) };
    expect(due(user, NOW - 2 * IDLE_MS, NOW)).toBe(false);
  });

  it("asks again an hour after the answer if nothing else happened since", () => {
    const user = { stillThereAt: ago(ANSWER_LASTS_MS + MIN) };
    expect(due(user, NOW - 2 * IDLE_MS, NOW)).toBe(true);
  });

  it("asks after three hours of unbroken takes, even while the player keeps playing", () => {
    const user = { potLastTakeAt: ago(8 * MIN), potRunStart: ago(BACKSTOP_MS + MIN) };
    expect(due(user, NOW, NOW)).toBe(true);
  });

  it("counts the three hours from the last answer when that is later", () => {
    const user = { potLastTakeAt: ago(8 * MIN), potRunStart: ago(BACKSTOP_MS + MIN), stillThereAt: ago(BACKSTOP_MS - MIN) };
    expect(due(user, NOW, NOW)).toBe(false);
  });

  it("starts a new run after a break, so a casual visit is never asked by the backstop", () => {
    const user = { potLastTakeAt: ago(RUN_GAP_MS + MIN), potRunStart: ago(10 * BACKSTOP_MS) };
    expect(runStart(user, NOW)).toBe(NOW);
    expect(due(user, NOW, NOW)).toBe(false);
  });

  it("keeps the run going while takes stay close together", () => {
    const user = { potLastTakeAt: ago(9 * MIN), potRunStart: ago(2 * BACKSTOP_MS / 3) };
    expect(runStart(user, NOW)).toBe(NOW - (2 * BACKSTOP_MS) / 3);
  });
});
