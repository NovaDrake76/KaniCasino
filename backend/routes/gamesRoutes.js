const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");

const User = require("../models/User");
const Case = require("../models/Case");
const upgradeItems = require("../games/upgrade");
const SlotGameController = require("../games/slot");
const { calculateLevelFromXp } = require("../utils/economy");
const { getWinningItem, addUniqueInfoToItem } = require("../utils/caseOpening");

// Exports
module.exports = (io) => {
  // Routes
  router.post("/openCase/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const quantityToOpen = req.body.quantity;
      const winningItems = [];

      const caseData = await Case.findById(id).populate("items");

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

      for (let i = 0; i < quantityToOpen; i++) {
        const winningItem = getWinningItem(caseData);
        const itemWithUniqueId = addUniqueInfoToItem(winningItem);
        winningItems.push(itemWithUniqueId);
      }

      // atomically charge the cost and add the items only if the balance covers it
      const updatedUser = await User.findOneAndUpdate(
        { _id: user._id, walletBalance: { $gte: cost } },
        {
          $inc: { walletBalance: -cost, xp: cost * 5 },
          $push: { inventory: { $each: winningItems } },
        },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(400).json({ message: "Insufficient balance" });
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

      res.json({ items: winningItems });

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