const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");
const { plinkoDropLimiter, diceRollLimiter, minesActionLimiter } = require("../middleware/rateLimit");

const User = require("../models/User");
const Case = require("../models/Case");
const Round = require("../models/Round");
const upgradeItems = require("../games/upgrade");
const SlotGameController = require("../games/slot");
const PlinkoGameController = require("../games/plinko");
const BlackjackGameController = require("../games/blackjack");
const DiceGameController = require("../games/dice");
const MinesGameController = require("../games/mines");
const { calculateLevelFromXp, recordTransaction, runAtomic, TX } = require("../utils/economy");
const referrals = require("../utils/referrals");
const { addUniqueInfoToItem } = require("../utils/caseOpening");
const { buildRangeTable } = require("../utils/caseRanges");
const { roll, pickFromRanges, TOTAL } = require("../utils/provablyFair");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const { sellValue, recomputeCaseValues } = require("../utils/itemValue");

// Exports
module.exports = (io) => {
  // Routes
  router.post("/openCase/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const quantityToOpen = req.body.quantity;
      const winningItems = [];

      let caseData = await Case.findById(id).populate("items");

      if (!caseData || !user) {
        if (!caseData) {
          return res.status(404).json({ message: "Case not found" });
        } else {
          return res.status(404).json({ message: "User not found" });
        }
      }

      if (!Number.isInteger(quantityToOpen)) {
        return res.status(400).json({ message: "Quantity to open must be an integer" });
      }

      if (quantityToOpen > 5) {
        return res.status(400).json({ message: "You can only open up to 5 cases at a time" });
      }

      if (quantityToOpen < 1) {
        return res.status(400).json({ message: "You need to open at least 1 case" });
      }

      const cost = caseData.price * quantityToOpen;

      // reserve the nonces atomically up front (never rolled back), then derive each
      // item from the case's committed range table (provably fair, one draw per open)
      const reserved = await seeds.reserveNonces(user._id, quantityToOpen);

      // self-heal: materialize + commit this case's config on first open if it has
      // none yet, so the roll stays verifiable even if the backfill hasn't run
      if (!caseData.rangeTable || !caseData.rangeTable.length) {
        await recomputeCaseValues(caseData._id);
        caseData = await Case.findById(id).populate("items");
      }
      let rangeTable = caseData.rangeTable;
      let configHash = caseData.configHash;
      const configVersion = caseData.configVersion || 0;
      if (!rangeTable || !rangeTable.length) {
        const built = buildRangeTable(caseData); // safety net (e.g. a case with no items)
        rangeTable = built.rangeTable;
        configHash = built.configHash;
      }

      const draws = [];
      for (let i = 0; i < quantityToOpen; i++) {
        const nonce = reserved.startNonce + i;
        const rollValue = roll(reserved.serverSeed, reserved.clientSeed, nonce); // 1..TOTAL
        const picked = pickFromRanges(rollValue, rangeTable);
        const sourceItem = caseData.items.find((it) => String(it._id) === String(picked.itemId));
        const itemWithUniqueId = addUniqueInfoToItem(sourceItem);
        winningItems.push(itemWithUniqueId);
        draws.push({ nonce, roll: rollValue, itemId: picked.itemId, uniqueId: itemWithUniqueId.uniqueId });
      }

      // charge the cost, add the items and write the ledger row together: a failed row
      // rolls the charge back, so the player is never charged without a record
      const updatedUser = await runAtomic(async (session) => {
        const u = await User.findOneAndUpdate(
          { _id: user._id, walletBalance: { $gte: cost } },
          {
            $inc: { walletBalance: -cost, xp: cost * 5 },
            $push: { inventory: { $each: winningItems } },
          },
          { new: true, session }
        );
        if (!u) return null;
        await recordTransaction(
          {
            userId: user._id,
            type: TX.CASE_OPEN,
            direction: "debit",
            amount: cost,
            balanceAfter: u.walletBalance,
            meta: { caseId: caseData._id, caseTitle: caseData.title, quantity: quantityToOpen },
          },
          session
        );
        return u;
      });

      if (!updatedUser) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // record one provably-fair audit roll per open (after the charge commits)
      const rollIds = [];
      for (const d of draws) {
        const rec = await rolls.recordRoll({
          game: "case",
          userId: user._id,
          seedId: reserved.seedId,
          clientSeed: reserved.clientSeed,
          serverSeedHash: reserved.serverSeedHash,
          nonce: d.nonce,
          roll: d.roll,
          total: TOTAL,
          caseId: caseData._id,
          caseConfigVersion: configVersion,
          caseConfigHash: configHash,
          itemId: d.itemId,
          uniqueId: d.uniqueId,
        });
        rollIds.push(rec.rollId);
      }

      const newLevel = calculateLevelFromXp(updatedUser.xp);
      if (newLevel !== updatedUser.level) {
        updatedUser.level = newLevel;
        await User.updateOne({ _id: user._id }, { $set: { level: newLevel } });
        referrals.maybePayReferralMilestone(user._id, newLevel).catch(() => {});
      }

      const winnerUser = {
        name: user.username,
        id: user._id,
        profilePicture: user.profilePicture
      }

      // Emit the caseOpened event
      io.emit("caseOpened", {
        winningItems: winningItems,
        user: winnerUser,
        caseImage: caseData.image,
      });

      res.json({
        items: winningItems.map((i, idx) => ({
          ...i,
          sellValue: sellValue(i.baseValue),
          rollId: rollIds[idx],
        })),
      });

      const userDataPayload = {
        walletBalance: updatedUser.walletBalance,
        xp: updatedUser.xp,
        level: updatedUser.level,
      }
      io.to(user._id.toString()).emit('userDataUpdated', userDataPayload);

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upgrade items
  router.post("/upgrade", isAuthenticated, async (req, res) => {
    const { selectedItemIds, targetItemId } = req.body;
    const user = req.user._id;


    const result = await upgradeItems(user, selectedItemIds, targetItemId);
    res.status(result.status).json(result);
  });

  // Spin the slot machine
  router.post('/slots', isAuthenticated, async (req, res) => {
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
  router.post("/blackjack/deal", isAuthenticated, blackjackAction(
    (req) => BlackjackGameController.deal(req.user._id, req.body.betAmount, io)
  ));
  router.post("/blackjack/hit", isAuthenticated, blackjackAction(
    (req) => BlackjackGameController.hit(req.user._id, io)
  ));
  router.post("/blackjack/stand", isAuthenticated, blackjackAction(
    (req) => BlackjackGameController.stand(req.user._id, io)
  ));
  router.post("/blackjack/double", isAuthenticated, blackjackAction(
    (req) => BlackjackGameController.double(req.user._id, io)
  ));
  router.post("/blackjack/split", isAuthenticated, blackjackAction(
    (req) => BlackjackGameController.split(req.user._id, io)
  ));
  router.post("/blackjack/insurance", isAuthenticated, blackjackAction(
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