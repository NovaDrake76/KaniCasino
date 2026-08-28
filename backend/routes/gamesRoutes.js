const express = require("express");
const badges = require("../utils/badges");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");
const {
  plinkoDropLimiter,
  diceRollLimiter,
  minesActionLimiter,
  hiloActionLimiter,
  caseOpenLimiter,
  upgradeLimiter,
  slotSpinLimiter,
  blackjackActionLimiter,
} = require("../middleware/rateLimit");

const Case = require("../models/Case");
const Round = require("../models/Round");
const upgradeItems = require("../games/upgrade");
const { openCase } = require("../games/openCase");
const SlotGameController = require("../games/slot");
const PlinkoGameController = require("../games/plinko");
const BlackjackGameController = require("../games/blackjack");
const DiceGameController = require("../games/dice");
const MinesGameController = require("../games/mines");
const HiloGameController = require("../games/hilo");

// Exports
module.exports = (io) => {
  // Routes
  // the opening itself lives in games/openCase.js, because the discord bot has to run the
  // same one: a second path through the money would drift from this one the first time
  // either changed.
  router.post("/openCase/:id", isAuthenticated, caseOpenLimiter, async (req, res) => {
    try {
      const result = await openCase({
        user: req.user,
        caseId: req.params.id,
        quantity: req.body.quantity,
        grantId: req.body.grantId,
      });
      if (!result.ok) return res.status(result.status).json({ message: result.message });
      res.json({ items: result.items });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Upgrade items
  router.post("/upgrade", isAuthenticated, upgradeLimiter, async (req, res) => {
    const { selectedItemIds, targetItemId } = req.body;
    const user = req.user;

    const result = await upgradeItems(user._id, selectedItemIds, targetItemId);

    // a won upgrade puts an item in someone's inventory exactly like an opening does, so
    // it belongs in the same feed. `source` is what keeps it honest: the card shows the
    // parent case, and without it the drop would read as having come out of one.
    if (result.success && result.item) {
      const parent = await Case.findById(result.item.case, { image: 1 }).lean();
      io.emit("caseOpened", {
        winningItems: [result.item],
        user: {
          name: user.username,
          id: user._id,
          profilePicture: user.profilePicture,
          badge: badges.wornBadge(user),
        },
        caseImage: parent ? parent.image : null,
        source: "upgrade",
      });
    }

    res.status(result.status).json(result);
  });

  // Spin the slot machine
  router.post('/slots', isAuthenticated, slotSpinLimiter, async (req, res) => {
    const user = req.user;

    try {
      const { betAmount } = req.body;

      const result = await SlotGameController.spin(user._id, betAmount, io);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // drop a plinko ball
  router.post('/plinko', isAuthenticated, plinkoDropLimiter, async (req, res) => {
    const user = req.user;

    try {
      const { betAmount, risk } = req.body;

      const result = await PlinkoGameController.drop(user._id, betAmount, risk, io);
      res.json(result);
    } catch (error) {
      // statused errors are intentional answers; anything else stays generic
      if (error.status) return res.status(error.status).json({ message: error.message });
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // roll the dice
  router.post('/dice', isAuthenticated, diceRollLimiter, async (req, res) => {
    const user = req.user;

    try {
      const { betAmount, target, direction } = req.body;

      const result = await DiceGameController.roll(user._id, betAmount, target, direction, io);
      res.json(result);
    } catch (error) {
      // statused errors are intentional answers; anything else stays generic
      if (error.status) return res.status(error.status).json({ message: error.message });
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // blackjack: a hand spans several requests, so each action resolves the user's
  // single active hand; statused errors are intentional answers (409 = resync)
  const blackjackAction = (fn) => async (req, res) => {
    try {
      res.json(await fn(req));
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  router.post("/blackjack/deal", isAuthenticated, blackjackActionLimiter, blackjackAction(
    (req) => BlackjackGameController.deal(req.user._id, req.body.betAmount, io)
  ));
  router.post("/blackjack/hit", isAuthenticated, blackjackActionLimiter, blackjackAction(
    (req) => BlackjackGameController.hit(req.user._id, io)
  ));
  router.post("/blackjack/stand", isAuthenticated, blackjackActionLimiter, blackjackAction(
    (req) => BlackjackGameController.stand(req.user._id, io)
  ));
  router.post("/blackjack/double", isAuthenticated, blackjackActionLimiter, blackjackAction(
    (req) => BlackjackGameController.double(req.user._id, io)
  ));
  router.post("/blackjack/split", isAuthenticated, blackjackActionLimiter, blackjackAction(
    (req) => BlackjackGameController.split(req.user._id, io)
  ));
  router.post("/blackjack/insurance", isAuthenticated, blackjackActionLimiter, blackjackAction(
    (req) => BlackjackGameController.insurance(req.user._id, req.body.accept, io)
  ));
  router.get("/blackjack/active", isAuthenticated, blackjackAction(
    async (req) => ({ hand: await BlackjackGameController.active(req.user._id) })
  ));

  // mines: a game spans several requests, so each action resolves the user's single
  // active game; reuses the statused-error wrapper (409 = resync)
  router.post("/mines/start", isAuthenticated, minesActionLimiter, blackjackAction(
    (req) => MinesGameController.start(req.user._id, req.body.betAmount, req.body.mineCount, io)
  ));
  router.post("/mines/reveal", isAuthenticated, minesActionLimiter, blackjackAction(
    (req) => MinesGameController.reveal(req.user._id, req.body.tile, io)
  ));
  router.post("/mines/cashout", isAuthenticated, minesActionLimiter, blackjackAction(
    (req) => MinesGameController.cashout(req.user._id, io)
  ));
  router.get("/mines/active", isAuthenticated, blackjackAction(
    async (req) => ({ game: await MinesGameController.active(req.user._id) })
  ));

  // hilo: a game spans several requests, so each action resolves the user's single
  // active game; reuses the statused-error wrapper (409 = resync)
  router.post("/hilo/start", isAuthenticated, hiloActionLimiter, blackjackAction(
    (req) => HiloGameController.start(req.user._id, req.body.betAmount, io)
  ));
  router.post("/hilo/guess", isAuthenticated, hiloActionLimiter, blackjackAction(
    (req) => HiloGameController.guess(req.user._id, req.body.direction, io)
  ));
  router.post("/hilo/skip", isAuthenticated, hiloActionLimiter, blackjackAction(
    (req) => HiloGameController.skip(req.user._id, io)
  ));
  router.post("/hilo/cashout", isAuthenticated, hiloActionLimiter, blackjackAction(
    (req) => HiloGameController.cashout(req.user._id, io)
  ));
  router.get("/hilo/active", isAuthenticated, blackjackAction(
    async (req) => ({ game: await HiloGameController.active(req.user._id) })
  ));

  // recent coin flip results, so the page has a history the moment it loads. light and
  // indexed (game + createdAt), capped, public: just the outcome, no bets or seeds.
  router.get("/coinflip/history", async (req, res) => {
    try {
      const limit = Math.min(Math.max(1, Math.floor(Number(req.query.limit)) || 15), 50);
      const rounds = await Round.find(
        { game: "coinflip", status: "settled" },
        { outcome: 1, createdAt: 1 }
      )
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      res.json(
        rounds.map((r) => ({
          result: r.outcome && r.outcome.result,
          winningSide: r.outcome && r.outcome.winningSide,
          at: r.createdAt,
        }))
      );
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  return router;
};