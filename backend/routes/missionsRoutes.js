const express = require("express");
const { isAuthenticated } = require("../middleware/authMiddleware");
const missions = require("../utils/missions");

// missions are always the authenticated user's own progress; there is no userId
// param (a user cannot view someone else's mission state).
module.exports = (io) => {
  const router = express.Router();

  // GET /missions : the catalog with this user's progress + claim state
  router.get("/", isAuthenticated, async (req, res) => {
    try {
      const data = await missions.getMissionsView(req.user._id);
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // POST /missions/:key/visit : mark a social mission's link clicked (honor-system)
  router.post("/:key/visit", isAuthenticated, async (req, res) => {
    try {
      const r = await missions.markVisited(req.user._id, req.params.key);
      if (!r.ok) return res.status(400).json({ message: "Not a social mission" });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // POST /missions/:key/claim : credit the reward once (atomic)
  router.post("/:key/claim", isAuthenticated, async (req, res) => {
    try {
      const r = await missions.claimMission(req.user._id, req.params.key, io);
      res.status(r.code).json(r.body);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  return router;
};
