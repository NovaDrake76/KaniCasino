const express = require("express");
const { isAuthenticated } = require("../middleware/authMiddleware");
const adRewards = require("../utils/adRewards");

module.exports = (io) => {
  const router = express.Router();

  // GET /rewards/ads : whether rewarded ads are on, which player to use, what is left today
  router.get("/ads", isAuthenticated, async (req, res) => {
    try {
      res.json(await adRewards.getStatus(req.user._id));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // POST /rewards/ads/start : issue the one-time watch token
  router.post("/ads/start", isAuthenticated, async (req, res) => {
    try {
      const r = await adRewards.startWatch(req.user._id);
      res.status(r.code).json(r.body);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // POST /rewards/ads/claim : redeem the token once the view is plausible (atomic)
  router.post("/ads/claim", isAuthenticated, async (req, res) => {
    try {
      const r = await adRewards.claimWatch(req.user._id, req.body.token);
      if (r.code === 200 && io) {
        io.to(req.user._id.toString()).emit("userDataUpdated", {
          walletBalance: r.body.user.walletBalance,
          xp: r.body.user.xp,
          level: r.body.user.level,
        });
      }
      const { user, ...pub } = r.body;
      res.status(r.code).json(pub);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  return router;
};
