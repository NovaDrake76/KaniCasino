const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { isAuthenticated, maybeAuthenticated } = require("../middleware/authMiddleware");
const halo = require("../utils/halo");
const { dayIndex, nextResetAt } = require("../utils/dailyGift");

const clientIp = (req) => req.headers["cf-connecting-ip"] || req.ip;

// a person guesses at most a few times a minute; this only stops a script walking the pool
const guessLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: clientIp,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { message: "Too many guesses. Try again in a minute." },
});

const today = async (res) => {
  const now = new Date();
  const day = dayIndex(now);
  const target = await halo.targetFor(day);
  if (!target) {
    res.status(503).json({ message: "Today's student is not ready yet" });
    return null;
  }
  return { now, day, target };
};

// the guessable roster. it only changes with a deploy, so the browser can keep it for an hour.
router.get("/daily-halo/students", (req, res) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.json(halo.publicPool());
});

router.get("/daily-halo/today", maybeAuthenticated, async (req, res) => {
  try {
    const ctx = await today(res);
    if (!ctx) return;
    const [summary, player] = await Promise.all([
      halo.summary(ctx.day),
      req.user ? halo.playerState(req.user._id, ctx.day, ctx.target) : null,
    ]);
    res.set("Cache-Control", "no-store");
    res.json({
      day: ctx.day,
      number: halo.puzzleNumber(ctx.day),
      nextAt: nextResetAt(ctx.now).toISOString(),
      maxGuesses: halo.MAX_GUESSES,
      poolSize: halo.POOL_SIZE,
      reward: halo.rewardTable(),
      ...summary,
      signedIn: !!req.user,
      play: player ? player.play : null,
      stats: player ? player.stats : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// a guest's game is kept in their browser; this scores the whole list every time, so the
// server never trusts a result it did not work out itself
router.post("/daily-halo/check", guessLimiter, async (req, res) => {
  try {
    const ctx = await today(res);
    if (!ctx) return;
    const result = halo.evaluate(ctx.target, req.body && req.body.guesses);
    await halo.countGuestFinish(ctx.day, clientIp(req), result);
    res.json({ play: await halo.present(result, ctx.target, null) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/daily-halo/guess", isAuthenticated, guessLimiter, async (req, res) => {
  try {
    const student = halo.studentByName(req.body && req.body.name);
    if (!student) return res.status(400).json({ message: "No student by that name", reason: "unknown" });
    const ctx = await today(res);
    if (!ctx) return;
    res.json(await halo.guess(req.user._id, ctx.day, ctx.target, student.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/daily-halo/adopt", isAuthenticated, async (req, res) => {
  try {
    const ctx = await today(res);
    if (!ctx) return;
    res.json(await halo.adopt(req.user._id, ctx.day, ctx.target, req.body && req.body.guesses));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
