const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");
const { verifyMailLimiter } = require("../middleware/rateLimit");
const verification = require("../utils/verification");

const reply = (res, result) => res.status(result.code).json(result.body);

// where the account stands: verified or not, how, and when the gated features start needing it
router.get("/verification", isAuthenticated, (req, res) => {
  res.json(verification.statusOf(req.user));
});

// a link to the account's own address, in the language the site is showing
router.post("/verify-email", isAuthenticated, verifyMailLimiter, async (req, res) => {
  try {
    reply(res, await verification.requestVerification(req.user._id, req.body && req.body.lang));
  } catch (err) {
    console.error("verify email:", err.message);
    res.status(500).json({ message: "Could not send the email, please try again" });
  }
});

// the link from the email. no session: it is often opened on another device than the one that asked for it
router.post("/verify-email/confirm", async (req, res) => {
  try {
    reply(res, await verification.confirm(req.body && req.body.token));
  } catch (err) {
    console.error("verify confirm:", err.message);
    res.status(500).json({ message: "Could not verify, please try again" });
  }
});

// a new address for the account, which only takes effect once its link is clicked
router.put("/email", isAuthenticated, verifyMailLimiter, async (req, res) => {
  try {
    const { email, password, lang } = req.body || {};
    reply(res, await verification.requestEmailChange(req.user._id, { email, password, lang }));
  } catch (err) {
    console.error("change email:", err.message);
    res.status(500).json({ message: "Could not change the email, please try again" });
  }
});

module.exports = router;
