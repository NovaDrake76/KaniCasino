const api = require("./api");
const { lotteryMessage } = require("./embeds");

// the coupon drops' channel; unset, the bot posts nothing
const CHANNEL_ID = process.env.COUPON_CHANNEL_ID || "";
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// the site draws at 20:00 utc; the bot looks for the result on a fixed five-minute grid for two hours after it
const DRAW_HOUR_UTC = 20;
const STEP = 5 * MINUTE;
const OFFSET = MINUTE;
const WINDOW_MS = 2 * HOUR;

// the next grid point at or after `after`: 20:01, 20:06 ... 21:56 utc, today's or the next day's
function nextCheckAt(after, hour = DRAW_HOUR_UTC) {
  for (let day = Math.floor(after / DAY) * DAY; ; day += DAY) {
    const first = day + hour * HOUR + OFFSET;
    const last = day + hour * HOUR + WINDOW_MS;
    const at = first + Math.max(0, Math.ceil((after - first) / STEP)) * STEP;
    if (at <= last) return at;
  }
}

// there is nowhere to remember a post across restarts, so a draw is posted by the one check whose window it settled
// in. the window starts where the last answered check ended, so a check the site did not answer is covered by the next
const settledIn = (last, from, to) => {
  const at = last && last.settledAt ? Date.parse(last.settledAt) : NaN;
  return Number.isFinite(at) && at > from && at <= to;
};

// one GET /lottery per check, 24 checks a day, all of them in the two hours after the draw
function start(client) {
  if (!CHANNEL_ID) return null;
  let timer = null;
  let from = null;
  const posted = new Set();
  const plan = (at) => {
    clearTimeout(timer);
    timer = setTimeout(() => run(at), Math.max(0, at - Date.now()));
  };
  const run = async (checkAt) => {
    const since = from === null || checkAt - from > WINDOW_MS ? checkAt - STEP : from;
    try {
      const state = await api.lottery();
      from = checkAt;
      const last = state.last;
      if (last && !posted.has(last.number) && settledIn(last, since, checkAt)) {
        const channel = await client.channels.fetch(CHANNEL_ID);
        await channel.send(lotteryMessage(last, state.draw));
        posted.add(last.number);
        console.log(`bot: posted lottery draw #${last.number}`);
      }
    } catch (err) {
      console.error("bot lottery post:", err.message);
    }
    plan(nextCheckAt(checkAt + 1));
  };
  plan(nextCheckAt(Date.now()));
  return () => clearTimeout(timer);
}

module.exports = { CHANNEL_ID, STEP, nextCheckAt, settledIn, start };
