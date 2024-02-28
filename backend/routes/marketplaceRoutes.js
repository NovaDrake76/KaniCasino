// routes/marketplaceRoutes.js

const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");

const User = require("../models/User");
const Item = require("../models/Item");
const Marketplace = require("../models/Marketplace");
const Notification = require("../models/Notification");

module.exports = (io) => {

  // Create new listing
  router.post("/", isAuthenticated, async (req, res) => {
    const { item, price } = req.body;

    //if price is not a number, if is less than 1 or if is greater than 1000000, return error
    if (isNaN(price) || price < 1 || price > 1000000) {
      return res.status(400).json({ message: "Invalid price" });
    }

    // Check if the item exists
    if (item === undefined || item === null || !item) {
      return res.status(404).json({ message: "Item not found" });
    }

    const user = await User.findById(req.user._id);

    if (user.level < 5) {
      return res.status(400).json({ message: "You must be at least level 5 to sell items" });
    }

    // Check if the item is in the user's inventory
    const inventoryItemIndex = user.inventory.find((inventoryItem) => {
      return inventoryItem._id.toString() === item.toString();
    });


    if (inventoryItemIndex === null || inventoryItemIndex === undefined) {
      return res.status(404).json({ message: "Item not found in inventory" });
    }

    // Remove the item from the user's inventory
    user.inventory = user.inventory.filter((inventoryItem) => {
      return inventoryItem._id.toString() !== item.toString();
    });

    await user.save();

    // Create a new marketplace item with the item object
    const marketplaceItem = new Marketplace({
      sellerId: user._id,
      item: inventoryItemIndex,
      price,
      itemName: inventoryItemIndex.name,
      itemImage: inventoryItemIndex.image,
      rarity: inventoryItemIndex.rarity,
    });

    await marketplaceItem.save();


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

    if (item.sellerId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    await Marketplace.deleteOne({ _id: req.params.id });

    // Add the item back to the user's inventory
    const user = await User.findById(req.user._id);
    user.inventory.unshift(item.item);
    await user.save();


    res.json({ message: "Item removed" });
  });

  // Buy an item
  router.post("/buy/:id", isAuthenticated, async (req, res) => {
    const item = await Marketplace.findById(req.params.id);
    const user = await User.findById(req.user._id);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (user.level < 10) {
      return res.status(400).json({ message: "You must be at least level 10 to buy items" });
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

    // Create a new notification
    const newNotification = new Notification({
      senderId: user._id,
      receiverId: seller._id,
      type: 'message',
      title: 'Item Sold',
      content: `Your ${item.itemName} has been sold for K₽${item.price}`,
    });

    // Save the notification to the database
    await newNotification.save();

    // Emit an event to the seller
    io.to(seller._id.toString()).emit("newNotification", {
      message: `Your ${item.itemName} has been sold for K₽${item.price}`
    });

    const SellerDataPayload = {
      walletBalance: seller.walletBalance,
      xp: seller.xp,
      level: seller.level,
    }
    io.to(seller._id.toString()).emit('userDataUpdated', SellerDataPayload);
  });

  return router;
}
