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

// the share card pulls one image per character it draws, and the browser caches it for
// a year, so a caller asking for many in a minute is not drawing cards
const artLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  keyGenerator: (req) => String(req.user._id),
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many images requested, slow down." },
});

// the limiters below all have the same shape, so they are built rather than copied. every
// one is keyed per user and runs after isAuthenticated, and every ceiling is set far above
// what a person can click: automation is allowed here, so these exist to bound what any one
// account can ask of the database, not to decide who is playing by hand.
const perUser = (max, message, windowMs = 10 * 1000) =>
  rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => String(req.user._id),
    skip: skipInTests,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: { message },
  });

// opening a case is the heaviest write here: a roll, an inventory entry per item, a ledger
// row and a broadcast to every connected client. a multi-open is still one request.
const caseOpenLimiter = perUser(30, "Too many openings, slow down a little.");

// an upgrade reads the staked copies and the catalog, then rewrites the inventory
const upgradeLimiter = perUser(30, "Too many upgrades, slow down a little.");

// one request per spin, same cost profile as a dice roll
const slotSpinLimiter = perUser(40, "Too many spins, slow down a little.");

// one request per action and a hand takes several, so it needs the headroom mines has
const blackjackActionLimiter = perUser(80, "Too many actions, slow down a little.");

// buying moves money and an inventory entry, and it is the one place where being fast is
// a real advantage over other players rather than only over the house edge
const marketBuyLimiter = perUser(30, "Too many purchases, slow down a little.");

// listing and buy orders both write a row that other players then read
const marketWriteLimiter = perUser(30, "Too many marketplace writes, slow down a little.");

module.exports = {
  artLimiter,
  loginLimiter,
  registerLimiter,
  registerDailyLimiter,
  createdAnAccount,
  plinkoDropLimiter,
  diceRollLimiter,
  minesActionLimiter,
  hiloActionLimiter,
  caseOpenLimiter,
  upgradeLimiter,
  slotSpinLimiter,
  blackjackActionLimiter,
  marketBuyLimiter,
  marketWriteLimiter,
};
