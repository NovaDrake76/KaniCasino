const express = require("express");
const { isAuthenticated } = require("../middleware/authMiddleware");
const referrals = require("../utils/referrals");

module.exports = (io) => {
  const router = express.Router();

  // GET /referrals/me : the affiliate dashboard (code, totals, per-referral stats)
  router.get("/me", isAuthenticated, async (req, res) => {
    try {
      const data = await referrals.getDashboard(req.user._id);
      if (!data) return res.status(404).json({ message: "User not found" });
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // POST /referrals/code : create the vanity code, once
  router.post("/code", isAuthenticated, async (req, res) => {
    try {
      const r = await referrals.setReferralCode(req.user._id, req.body.code);
      res.status(r.code).json(r.body);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // POST /referrals/claim : pay out the commission earned so far (atomic)
  router.post("/claim", isAuthenticated, async (req, res) => {
    try {
      const r = await referrals.claimCommission(req.user._id);
      if (r.code === 200 && io) {
        io.to(req.user._id.toString()).emit("userDataUpdated", {
          walletBalance: r.body.user.walletBalance,
          xp: r.body.user.xp,
          level: r.body.user.level,
        });
      }
      res.status(r.code).json(
        r.code === 200 ? { claimed: r.body.claimed, walletBalance: r.body.user.walletBalance } : r.body
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  return router;
};
