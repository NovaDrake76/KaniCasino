// the only events the site may record and the params each may carry; anything else in a batch is dropped, so the
// endpoint cannot be turned into free storage. src/services/usage/usage.ts declares the same list, and a test holds them equal
const EVENTS = {
  daisu_open: ["via", "showing", "attention"],
  daisu_room: ["via", "from", "item"],
  daisu_close: ["via", "from", "secs"],
  mission_help: ["mission"],
  mission_claim_failed: ["mission", "status"],
  shop_item: ["item", "state", "via"],
  shop_buy_failed: ["item", "status", "reason"],
  locked_view: ["unlock"],
  help_start: ["goal", "mission"],
  help_end: ["goal", "step"],
  tour_step: ["step"],
};

const MAX_EVENTS = 50;
// a batch waits at most half a minute in the page, so anything older than this is a clock that cannot be trusted
const MAX_AGO_MS = 10 * 60 * 1000;
const MAX_TEXT = 40;

const paramsOf = (name, raw) => {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of EVENTS[name]) {
    const v = raw[key];
    if (typeof v === "string" && v) out[key] = v.slice(0, MAX_TEXT);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
  }
  return out;
};

// a posted batch turned into documents: unknown names and params gone, text cut short, each time taken from the
// server's clock less how long the event sat in the page
function cleanBatch(body, userId, now = Date.now()) {
  const events = body && Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [];
  const sid = body && typeof body.sid === "string" && /^[a-z0-9]{1,40}$/i.test(body.sid) ? body.sid : null;
  return events
    .filter((e) => e && typeof e.name === "string" && Object.prototype.hasOwnProperty.call(EVENTS, e.name))
    .map((e) => ({
      userId,
      name: e.name,
      params: paramsOf(e.name, e.params),
      path: typeof e.path === "string" && e.path.startsWith("/") ? e.path.slice(0, 100) : null,
      sid,
      at: new Date(now - Math.min(MAX_AGO_MS, Math.max(0, Number(e.ago) || 0))),
    }));
}

// a person sends a few dozen events a day; the cap stops one account filling the free tier's storage (a script at the
// rate limit would write ~230 MB a day). kept in memory and cleared each utc day, so a restart only ever errs generous
const DAILY_CAP = 1000;

function createBudget(cap = DAILY_CAP) {
  const spent = new Map();
  let today = null;
  return (userId, wanted, now = Date.now()) => {
    const day = Math.floor(now / 86400000);
    if (day !== today) {
      spent.clear();
      today = day;
    }
    const used = spent.get(String(userId)) || 0;
    const allowed = Math.max(0, Math.min(wanted, cap - used));
    spent.set(String(userId), used + allowed);
    return allowed;
  };
}

module.exports = { EVENTS, MAX_EVENTS, DAILY_CAP, cleanBatch, createBudget };
