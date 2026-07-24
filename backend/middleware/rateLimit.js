const rateLimit = require("express-rate-limit");

// the app sits behind a cloudflare tunnel, so every request reaches express from
// localhost: keying on req.ip would throttle all users as one. cf-connecting-ip is
// set by cloudflare and a client cannot forge it through the tunnel. no fallback to
// x-forwarded-for: that one is client-supplied, so it would hand out free buckets.
function clientIp(req) {
  return req.headers["cf-connecting-ip"] || req.ip;
}

const skipInTests = () => process.env.NODE_ENV === "test";

// only failed logins count, so a legitimate user is never locked out
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: clientIp,
  skipSuccessfulRequests: true,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many login attempts. Try again in a few minutes." },
});

// caps account farming (each new account is handed a starting balance and a bonus)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: clientIp,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many accounts created from this address. Try again later." },
});

// hard cap on plinko drops now that the client fires them concurrently; keyed per
// user (runs after auth), generous enough that a fast human never hits it
const plinkoDropLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 40,
  keyGenerator: (req) => String(req.user._id),
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many drops, slow down a little." },
});

// dice rolls are one request each and fire fast on autobet; keyed per user (after auth)
const diceRollLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 40,
  keyGenerator: (req) => String(req.user._id),
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many rolls, slow down a little." },
});

// mines fires one request per tile revealed, so a player clicking through a board needs
// more headroom than a one-roll game; keyed per user (after auth)
const minesActionLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 80,
  keyGenerator: (req) => String(req.user._id),
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many actions, slow down a little." },
});

module.exports = { loginLimiter, registerLimiter, plinkoDropLimiter, diceRollLimiter, minesActionLimiter };
