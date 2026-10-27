const api = require("./api");
const { couponMessage } = require("./embeds");

// the channel the daily coupon is posted in. unset, the bot drops nothing
const CHANNEL_ID = process.env.COUPON_CHANNEL_ID || "";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// a failed drop (the site restarting, say) is tried again this much later, a few times at most
const RETRY_MS = 15 * 60 * 1000;
const RETRIES = 3;

// the utc hours a drop may land in; the default is the afternoon in brazil and the day in the us
const windowOf = (raw = process.env.COUPON_HOURS_UTC || "12-23") => {
  const [from, to] = String(raw).split("-").map(Number);
  return Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to <= 24 && from < to ? { from, to } : { from: 12, to: 23 };
};

// a random moment in the first window with room left after `after`, today's or the next day's
function nextDropAt(after, random = Math.random, hours = windowOf()) {
  const day = Math.floor(after / DAY) * DAY;
  for (const start of [day, day + DAY]) {
    const from = Math.max(start + hours.from * HOUR, after);
    const to = start + hours.to * HOUR;
    if (from < to) return from + Math.floor(random() * (to - from));
  }
  return day + DAY + hours.from * HOUR;
}

const tomorrow = (now) => (Math.floor(now / DAY) + 1) * DAY;

// the site caps the drops a day, so a restart that rolls a second time today only hears "already out"
function start(client) {
  if (!CHANNEL_ID) return null;
  let timer = null;
  const plan = (at, tries = 0) => {
    clearTimeout(timer);
    timer = setTimeout(() => run(tries), Math.max(0, at - Date.now()));
    console.log(`bot: next coupon drop at ${new Date(at).toISOString()}`);
  };
  const run = async (tries) => {
    try {
      // the channel first: a drop nobody can see would still use up the day
      const channel = await client.channels.fetch(CHANNEL_ID);
      const coupon = await api.dropCoupon();
      await channel.send(couponMessage(coupon));
      console.log(`bot: dropped coupon ${coupon.code}`);
    } catch (err) {
      if (err.status !== 409 && tries < RETRIES) {
        console.error("bot coupon drop:", err.message);
        return plan(Date.now() + RETRY_MS, tries + 1);
      }
      if (err.status !== 409) console.error("bot coupon drop gave up:", err.message);
    }
    plan(nextDropAt(tomorrow(Date.now())));
  };
  plan(nextDropAt(Date.now() + 60 * 1000));
  return () => clearTimeout(timer);
}

module.exports = { CHANNEL_ID, windowOf, nextDropAt, start };
