const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");

const User = require("../models/User");
const Case = require("../models/Case");

// Rarities array
const Rarities = [
  { id: "1", chance: 0.7992 },
  { id: "2", chance: 0.1598 },
  { id: "3", chance: 0.032 },
  { id: "4", chance: 0.0064 },
  { id: "5", chance: 0.0026 },
];

// Routes
router.post("/openCase/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    // Get the case and user
    const caseData = await Case.findById(id).populate("items");
    const user = await User.findById(userId);

    if (!caseData || !user) {
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      } else {
        return res.status(404).json({ message: "User not found" });
      }
    }

    // Check if the user has enough balance
    if (user.wallet < caseData.price) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Update the user's wallet
    user.wallet -= caseData.price;
    await user.save();

    // Calculate the rarity ranges for items based on rarity
    const rarityRanges = caseData.items.reduce((acc, item) => {
      const rarity = Rarities.find((r) => r.id === item.rarity);
      acc.push({ ...item, range: rarity.chance });
      return acc;
    }, []);

    // Sort the rarity ranges in descending order
    rarityRanges.sort((a, b) => b.range - a.range);

    // Get the winning item based on the rarity ranges
    const randomNumber = Math.random();
    let cumulativerarity = 0;
    const winningItem = rarityRanges.find((item) => {
      cumulativerarity += item.range;
      return randomNumber <= cumulativerarity;
    });

    // Add the winning item to the user's inventory
    user.inventory.push(winningItem._doc._id);
    await user.save();

    // Return the winning item
    res.json({ item: winningItem._doc });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
