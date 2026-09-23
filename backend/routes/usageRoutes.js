const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { usageLimiter } = require("../middleware/rateLimit");
const UsageEvent = require("../models/UsageEvent");
const { cleanBatch, createBudget } = require("../utils/usage");

const budget = createBudget();

// the page's batch of usage events. best effort on both sides: the page never waits on it and never retries, and a
// batch is trimmed to what is allowed rather than refused, so a stale client never loses the events that are still valid
router.post("/", authMiddleware.isAuthenticated, usageLimiter, async (req, res) => {
  const cleaned = cleanBatch(req.body, req.user._id);
  const docs = cleaned.slice(0, budget(req.user._id, cleaned.length));
  if (docs.length) {
    try {
      await UsageEvent.insertMany(docs, { ordered: false });
    } catch (err) {
      console.error("usage events:", err.message);
    }
  }
  res.status(204).end();
});

module.exports = router;
