const { due, runStart, isVisit, IDLE_MS, ANSWER_LASTS_MS, BACKSTOP_MS, VISIT_MS } = require("../../utils/stillThere");

const MIN = 60 * 1000;
const NOW = 100 * 24 * 60 * MIN;
const ago = (ms) => new Date(NOW - ms);
// in the middle of a run of takes: the last one a pot ago
const claiming = (fields = {}) => ({ potLastTakeAt: ago(8 * MIN), potRunStart: ago(20 * MIN), ...fields });

describe("daisu's still there?", () => {
  it("never asks on a visit, a take an hour or more after the last one", () => {
    const user = { potLastTakeAt: ago(VISIT_MS), potRunStart: ago(10 * BACKSTOP_MS) };
    expect(isVisit(user, NOW)).toBe(true);
    expect(due(user, NOW - 10 * IDLE_MS, NOW)).toBe(false);
  });

  it("never asks on the very first take", () => {
    expect(due({}, NOW - 10 * IDLE_MS, NOW)).toBe(false);
  });

  it("leaves a player alone who did something else in the last half hour", () => {
    expect(due(claiming(), NOW - (IDLE_MS - MIN), NOW)).toBe(false);
  });

  it("asks once the player has done nothing but take the pot for half an hour", () => {
    expect(due(claiming(), NOW - (IDLE_MS + MIN), NOW)).toBe(true);
  });

  it("does not ask again within the hour after an answer", () => {
    expect(due(claiming({ stillThereAt: ago(ANSWER_LASTS_MS - MIN) }), NOW - 2 * IDLE_MS, NOW)).toBe(false);
  });

  it("asks again an hour after the answer if nothing else happened since", () => {
    expect(due(claiming({ stillThereAt: ago(ANSWER_LASTS_MS + MIN) }), NOW - 2 * IDLE_MS, NOW)).toBe(true);
  });

  it("asks after three hours of unbroken takes, even while the player keeps playing", () => {
    expect(due(claiming({ potRunStart: ago(BACKSTOP_MS + MIN) }), NOW, NOW)).toBe(true);
  });

  it("counts the three hours from the last answer when that is later", () => {
    const user = claiming({ potRunStart: ago(BACKSTOP_MS + MIN), stillThereAt: ago(BACKSTOP_MS - MIN) });
    expect(due(user, NOW, NOW)).toBe(false);
  });

  it("starts a new run on a visit, and keeps it going while takes stay within the hour", () => {
    expect(runStart({ potLastTakeAt: ago(VISIT_MS + MIN), potRunStart: ago(10 * BACKSTOP_MS) }, NOW)).toBe(NOW);
    expect(runStart({ potLastTakeAt: ago(VISIT_MS - MIN), potRunStart: ago(2 * BACKSTOP_MS / 3) }, NOW)).toBe(NOW - (2 * BACKSTOP_MS) / 3);
  });
});
