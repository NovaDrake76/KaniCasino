// routes/marketplaceRoutes.js

const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");

const User = require("../models/User");
const Item = require("../models/Item");
const Marketplace = require("../models/Marketplace");

// Create new listing
router.post("/", isAuthenticated, async (req, res) => {
  const { item, price } = req.body;

  //if price is not a number or is less than 0, return error
  if (isNaN(price) || price < 0) {
    return res.status(400).json({ message: "Invalid price" });
  }

  const user = await User.findById(req.user._id);

  // Check if the item is in the user's inventory
  const inventoryItemIndex = user.inventory.findIndex(
    (i) => i._id.toString() === item._id
  );

  if (inventoryItemIndex === -1) {
    return res.status(404).json({ message: "Item not found" });
  }

  // Create a new marketplace item with the item object
  const marketplaceItem = new Marketplace({
    sellerId: user._id,
    item,
    price,
    itemName: item.name,
    itemImage: item.image,
    rarity: item.rarity,
  });

  await marketplaceItem.save();

  // Remove the item from the user's inventory
  user.inventory.splice(inventoryItemIndex, 1);
  await user.save();

  res.json(marketplaceItem);
});

// Get all listings
router.get("/", async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 30;
  const skip = (page - 1) * limit;

  const total = await Marketplace.countDocuments();
  const items = await Marketplace.find()
    .populate("sellerId", "username")
    .sort({ createdAt: -1 }) // sort in descending order of creation time
    .skip(skip)
    .limit(limit);

  res.json({
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    items,
  });
});

// Delete listing
router.delete("/:id", isAuthenticated, async (req, res) => {
  const item = await Marketplace.findOne({
    _id: req.params.id,
    sellerId: req.user._id,
  });

  if (!item) {
    return res.status(404).json({ message: "Item not found" });
  }

  await item.remove();
  res.json({ message: "Item removed" });
});

// Buy an item
router.post("/buy/:id", isAuthenticated, async (req, res) => {
  const item = await Marketplace.findById(req.params.id);
  const user = await User.findById(req.user._id);

  if (!item) {
    return res.status(404).json({ message: "Item not found" });
  }

  if (user.walletBalance < item.price) {
    return res.status(400).json({ message: "Insufficient balance" });
  }

  user.walletBalance -= item.price;
  user.inventory.unshift(item.item);
  await user.save();

  const seller = await User.findById(item.sellerId);
  seller.walletBalance += item.price;
  await seller.save();

  await Marketplace.deleteOne({ _id: req.params.id });

  res.json({ message: "Item purchased" });
});

module.exports = router;
