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
    const { item: uniqueId, price } = req.body; 

    // if price is not a number, if is less than 1 or if is greater than 1000000, return error
    if (isNaN(price) || price < 1 || price > 1000000) {
      return res.status(400).json({ message: "Invalid price" });
    }

    const user = await User.findById(req.user._id);

    if (user.level < 5) {
      return res.status(400).json({ message: "You must be at least level 5 to sell items" });
    }

    // Check if the item is in the user's inventory by uniqueId
    const inventoryItemIndex = user.inventory.findIndex((inventoryItem) => {
      return inventoryItem.uniqueId === uniqueId;
    });

    if (inventoryItemIndex === -1) {
      return res.status(404).json({ message: "Item not found in inventory" });
    }

    // Remove the item from the user's inventory
    const [inventoryItem] = user.inventory.splice(inventoryItemIndex, 1);

    await user.save();

    // Find the original item document
    const itemDocument = await Item.findById(inventoryItem._id);
    if (!itemDocument) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Create a new marketplace item with the item object
    const marketplaceItem = new Marketplace({
      sellerId: user._id,
      item: itemDocument._id,
      price,
      itemName: itemDocument.name,
      itemImage: itemDocument.image,
      rarity: itemDocument.rarity,
      uniqueId: inventoryItem.uniqueId,
    });

    await marketplaceItem.save();

    res.json(marketplaceItem);
  });

  // Get all listings
  router.get("/", async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;
    const skip = (page - 1) * limit;
    const { name, rarity, sortBy, order } = req.query;

    let filter = {};

    if (name) filter.itemName = { $regex: new RegExp(name, "i") };
    if (rarity) filter.rarity = rarity;

    let sortOptions = {};
    if (sortBy) {
      sortOptions[sortBy] = order === "asc" ? 1 : -1;
    } else {
      sortOptions = { createdAt: -1 };
    }

    const total = await Marketplace.countDocuments(filter);
    const items = await Marketplace.find(filter)
      .populate("sellerId", "username")
      .populate("item")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    res.json({
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      items,
    });
  });

  // Get listings for a specific item
  router.get("/item/:itemId", async (req, res) => {
    const { itemId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const total = await Marketplace.countDocuments({ item: itemId });
    const items = await Marketplace.find({ item: itemId })
      .populate("sellerId", "username")
      .populate("item")
      .sort({ price: 1 })
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
    try {
      const query = Marketplace.where({
        uniqueId: req.params.id,
        sellerId: req.user._id,
      });
      const item = await query.findOne();

      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      if (item.sellerId.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await Marketplace.deleteOne({ uniqueId: req.params.id });

      // Add the item back to the user's inventory
      const user = await User.findById(req.user._id);
      user.inventory.unshift({
        _id: item.item,
        name: item.itemName,
        image: item.itemImage,
        rarity: item.rarity,
        uniqueId: item.uniqueId,
      });
      await user.save();

      res.json({ message: "Item removed" });
    } catch (err) {
      console.log(err);
    }
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
    user.inventory.unshift({
      _id: item.item,
      name: item.itemName,
      image: item.itemImage,
      rarity: item.rarity,
      uniqueId: item.uniqueId,
    });
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
    };
    io.to(seller._id.toString()).emit('userDataUpdated', SellerDataPayload);
  });

  return router;
};
