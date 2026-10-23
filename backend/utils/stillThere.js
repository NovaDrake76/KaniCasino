// daisu asks "still there?" before a take once the player has done nothing but take the pot for half an hour, then at most
// once an hour, and after three hours of unbroken takes even while playing. a macro that only takes the pot cannot answer
const IDLE_MS = 30 * 60 * 1000;
const ANSWER_LASTS_MS = 60 * 60 * 1000;
const BACKSTOP_MS = 3 * 60 * 60 * 1000;
// a take this long after the last one is a visit, someone coming back for the pot, which is what it is for: never asked.
// it also ends a run of takes, so the backstop only ever counts unbroken claiming
const VISIT_MS = 60 * 60 * 1000;

const ms = (date) => (date ? new Date(date).getTime() : 0);

const isVisit = (user, now) => {
  const last = ms(user.potLastTakeAt);
  return !last || now - last >= VISIT_MS;
};

// when the run a take at `now` belongs to began
const runStart = (user, now) => (isVisit(user, now) || !user.potRunStart ? now : ms(user.potRunStart));

const due = (user, lastActive, now = Date.now()) => {
  if (isVisit(user, now)) return false;
  const answered = ms(user.stillThereAt);
  if (now - lastActive > IDLE_MS && now - answered > ANSWER_LASTS_MS) return true;
  return now - Math.max(answered, runStart(user, now)) > BACKSTOP_MS;
};

module.exports = { due, runStart, isVisit, IDLE_MS, ANSWER_LASTS_MS, BACKSTOP_MS, VISIT_MS };
