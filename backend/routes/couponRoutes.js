const express = require("express");
const { isAuthenticated } = require("../middleware/authMiddleware");
const { couponRedeemLimiter } = require("../middleware/rateLimit");
const coupons = require("../utils/coupons");

const router = express.Router();

// POST /coupons/redeem { code } : pays the code's amount once to this account
router.post("/redeem", isAuthenticated, couponRedeemLimiter, async (req, res) => {
  try {
    const r = await coupons.redeem(req.user, req.body && req.body.code);
    res.status(r.code).json(r.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
