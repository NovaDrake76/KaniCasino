// daisu asks "still there?" before a take once the player has done nothing but take the pot for half an hour, then at most
// once an hour, and after three hours of unbroken takes even while playing. a macro that only takes the pot cannot answer
const IDLE_MS = 30 * 60 * 1000;
const ANSWER_LASTS_MS = 60 * 60 * 1000;
const BACKSTOP_MS = 3 * 60 * 60 * 1000;
// takes further apart than this start a new run, so a casual visit is never asked by the backstop
const RUN_GAP_MS = 30 * 60 * 1000;

const ms = (date) => (date ? new Date(date).getTime() : 0);

// when the run a take at `now` belongs to began
const runStart = (user, now) => {
  const last = ms(user.potLastTakeAt);
  return last && now - last <= RUN_GAP_MS && user.potRunStart ? ms(user.potRunStart) : now;
};

const due = (user, lastActive, now = Date.now()) => {
  const answered = ms(user.stillThereAt);
  if (now - lastActive > IDLE_MS && now - answered > ANSWER_LASTS_MS) return true;
  return now - Math.max(answered, runStart(user, now)) > BACKSTOP_MS;
};

module.exports = { due, runStart, IDLE_MS, ANSWER_LASTS_MS, BACKSTOP_MS, RUN_GAP_MS };
