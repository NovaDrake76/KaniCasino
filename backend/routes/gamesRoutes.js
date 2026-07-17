const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");

const User = require("../models/User");
const Case = require("../models/Case");
const upgradeItems = require("../games/upgrade");
const SlotGameController = require("../games/slot");
const { calculateLevelFromXp, recordTransaction, runAtomic, TX } = require("../utils/economy");
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


  return router;
};