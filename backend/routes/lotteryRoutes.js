const express = require("express");
const { isAuthenticated, maybeAuthenticated } = require("../middleware/authMiddleware");
const { lotteryBuyLimiter } = require("../middleware/rateLimit");
const { oneAtATime } = require("../middleware/oneAtATime");
const lottery = require("../games/lottery");

module.exports = (io) => {
  const router = express.Router();

  // public; with a token it adds the player's own tickets in the open draw and the last one
  router.get("/", maybeAuthenticated, async (req, res) => {
    try {
      res.json(await lottery.state(req.user));
    } catch (error) {
      console.error("lottery state", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // public and cached: the open draw's pot and the time now for the home page, null while there is none
  router.get("/pot", async (req, res) => {
    try {
      res.json(await lottery.pot());
    } catch (error) {
      console.error("lottery pot", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // a purchase takes a stake, so it waits in the same one line per player as every game
  router.post("/tickets", isAuthenticated, lotteryBuyLimiter, oneAtATime, async (req, res) => {
    try {
      const result = await lottery.buyTickets({ user: req.user, picks: req.body && req.body.picks, io });
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error("lottery buy", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  router.get("/draws", async (req, res) => {
    try {
      res.json(await lottery.history(req.query.page));
    } catch (error) {
      console.error("lottery history", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  router.get("/draws/:number/tickets", isAuthenticated, async (req, res) => {
    try {
      const result = await lottery.ticketsIn(req.user._id, req.params.number);
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error("lottery tickets", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  return router;
};
