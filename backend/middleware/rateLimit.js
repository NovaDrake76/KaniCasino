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

// only a request that actually created an account spends the budget. a typo'd email, a
// taken username or a returning player signing back in with google must not burn it:
// carriers and campuses put thousands of real people behind one address.
const createdAnAccount = (req, res) => res.locals.createdAccount === true;

// caps account farming. a new account is handed a starting balance, and a referral code
// on top of it pays the referrer too, which makes registration the cheapest faucet here.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: clientIp,
  skipFailedRequests: true,
  requestWasSuccessful: createdAnAccount,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many accounts created from this address. Try again later." },
});

// the hourly cap on its own still allows 72 accounts a day from one address, which is the
// exact shape of the farm it exists to stop
const registerDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 8,
  keyGenerator: clientIp,
  skipFailedRequests: true,
  requestWasSuccessful: createdAnAccount,
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

// hilo fires one request per prediction/skip; keyed per user (after auth), same headroom as mines
const hiloActionLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 80,
  keyGenerator: (req) => String(req.user._id),
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many actions, slow down a little." },
});

module.exports = {
  loginLimiter,
  registerLimiter,
  registerDailyLimiter,
  createdAnAccount,
  plinkoDropLimiter,
  diceRollLimiter,
  minesActionLimiter,
  hiloActionLimiter,
};
