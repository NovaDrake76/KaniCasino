const mongoose = require("mongoose");
const { monitorEventLoopDelay } = require("perf_hooks");

// what the origin itself takes, so a slow site can be pinned on this box, atlas, or the road in between
const SLOW_MS = 3000;
const KEPT = 2000;
const PING_EVERY_MS = 5000;

const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();

let window = [];
let windowStarted = Date.now();
const slowest = new Map();

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);
// the route pattern rather than the path, so ids do not split one route into thousands and a scanner's made-up urls share one line
const routeOf = (req) => (req.route ? `${req.baseUrl || ""}${req.route.path}` : "(no route)");

function middleware(req, res, next) {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (window.length < KEPT) window.push(ms);
    const route = `${req.method} ${routeOf(req)}`;
    if (ms > (slowest.get(route) || 0)) slowest.set(route, ms);
    if (ms >= SLOW_MS) console.log(`slow request: ${route} ${Math.round(ms)}ms ${res.statusCode}`);
  });
  next();
}

// one ping per window at most, so a monitor polling this cannot spend atlas's 100 operations a second
let lastPing = { at: 0, ms: null };
async function dbPing() {
  if (Date.now() - lastPing.at < PING_EVERY_MS) return lastPing.ms;
  const started = process.hrtime.bigint();
  let ms = null;
  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    ms = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
  } catch (err) {
    ms = null;
  }
  lastPing = { at: Date.now(), ms };
  return ms;
}

function snapshot() {
  const sorted = [...window].sort((a, b) => a - b);
  return {
    requests: window.length,
    sinceSeconds: Math.round((Date.now() - windowStarted) / 1000),
    p50Ms: Math.round(percentile(sorted, 0.5)),
    p95Ms: Math.round(percentile(sorted, 0.95)),
    loopP99Ms: Math.round(loop.percentile(99) / 1e6),
  };
}

// a line every 10 minutes in the pm2 log, kept by logrotate for a week, to look back on when somebody says it was slow; reads one atlas ping per run
function summarize() {
  const now = snapshot();
  const worst = [...slowest].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r, ms]) => `${r} ${Math.round(ms)}ms`);
  window = [];
  windowStarted = Date.now();
  slowest.clear();
  loop.reset();
  return dbPing().then((db) => {
    if (now.requests) console.log(`origin: ${now.requests} req in ${now.sinceSeconds}s, p50 ${now.p50Ms}ms, p95 ${now.p95Ms}ms, db ping ${db == null ? "down" : `${db}ms`}, loop p99 ${now.loopP99Ms}ms; slowest ${worst.join(", ")}`);
  });
}

function startSummaries(everyMs = 10 * 60 * 1000) {
  const timer = setInterval(summarize, everyMs);
  if (timer.unref) timer.unref();
  return timer;
}

async function health() {
  const db = await dbPing();
  return { status: db == null ? "db-down" : "ok", dbMs: db, ...snapshot(), uptime: Math.round(process.uptime()) };
}

module.exports = { middleware, health, startSummaries, summarize, SLOW_MS };
