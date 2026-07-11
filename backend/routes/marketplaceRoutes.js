const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");

const User = require("../models/User");
const Item = require("../models/Item");
const Marketplace = require("../models/Marketplace");
const Notification = require("../models/Notification");
const { creditUser, recordTransaction, TX } = require("../utils/economy");

module.exports = (io) => {
  // Create new listing
  router.post("/", isAuthenticated, async (req, res) => {
    try {
      const { item: uniqueId, price } = req.body;

      // if price is not a number, if is less than 1 or if is greater than 1000000, return error
      if (isNaN(price) || price < 1 || price > 1000000) {
        return res.status(400).json({ message: "Invalid price" });
      }

      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.level < 5) {
        return res.status(400).json({ message: "You must be at least level 5 to sell items" });
      }

      // find the item in the inventory by uniqueId
      const inventoryItem = user.inventory.find(
        (item) => item.uniqueId === uniqueId
      );

      if (!inventoryItem) {
        return res.status(404).json({ message: "Item not found in inventory" });
      }

      // resolve the original item document (and its case) before touching anything
      const itemDocument = await Item.findById(inventoryItem._id);
      if (!itemDocument) {
        return res.status(404).json({ message: "Item not found" });
      }

      // atomically remove exactly this item; if it's already gone, abort without listing
      const pull = await User.updateOne(
        { _id: user._id },
        { $pull: { inventory: { uniqueId } } }
      );
      if (pull.modifiedCount === 0) {
        return res.status(404).json({ message: "Item not found in inventory" });
      }

      const marketplaceItem = new Marketplace({
        sellerId: user._id,
        item: itemDocument._id,
        case: itemDocument.case,
        price,
        itemName: itemDocument.name,
        itemImage: itemDocument.image,
        rarity: itemDocument.rarity,
        uniqueId: inventoryItem.uniqueId,
      });

      await marketplaceItem.save();

      res.json(marketplaceItem);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all listings
  router.get("/", async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 30;
      const skip = (page - 1) * limit;
      const { name, rarity, sortBy, order } = req.query;

      let itemFilter = {};
      if (name) itemFilter.name = { $regex: new RegExp(name, "i") };
      if (rarity) itemFilter.rarity = rarity;

      const items = await Item.find(itemFilter).exec();
      const totalItemsCount = await Item.countDocuments(itemFilter);

      const itemIds = items.map(item => item._id);
      const marketplaceData = await Marketplace.aggregate([
        { $match: { item: { $in: itemIds } } },
        {
          $group: {
            _id: "$item",
            cheapestPrice: { $min: "$price" },
            totalListings: { $sum: 1 },
            mostRecent: { $max: "$createdAt" }
          }
        }
      ]);

      const itemsWithMarketplaceData = items.map(item => {
        const marketplaceItem = marketplaceData.find(md => md._id.toString() === item._id.toString());
        return {
          ...item.toObject(),
          cheapestPrice: marketplaceItem ? marketplaceItem.cheapestPrice : null,
          totalListings: marketplaceItem ? marketplaceItem.totalListings : 0,
          mostRecent: marketplaceItem ? marketplaceItem.mostRecent : new Date(0)
        };
      });

      const itemsWithListings = itemsWithMarketplaceData.filter(item => item.totalListings > 0);
      const itemsWithoutListings = itemsWithMarketplaceData.filter(item => item.totalListings === 0);

      itemsWithListings.sort((a, b) => {
        return new Date(b.mostRecent) - new Date(a.mostRecent);
      });

      const sortedItems = [...itemsWithListings, ...itemsWithoutListings];

      const paginatedItems = sortedItems.slice(skip, skip + limit);

      res.json({
        totalPages: Math.ceil(totalItemsCount / limit),
        currentPage: page,
        items: paginatedItems,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
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
      // atomically remove only if it belongs to this seller
      const item = await Marketplace.findOneAndDelete({
        uniqueId: req.params.id,
        sellerId: req.user._id,
      });

      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // give the item back to the seller's inventory
      await User.updateOne(
        { _id: req.user._id },
        {
          $push: {
            inventory: {
              _id: item.item,
              name: item.itemName,
              image: item.itemImage,
              rarity: item.rarity,
              case: item.case,
              createdAt: new Date(), // acquired now, so it sorts as newest
              uniqueId: item.uniqueId,
            },
          },
        }
      );

      res.json({ message: "Item removed" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Buy an item
  router.post("/buy/:id", isAuthenticated, async (req, res) => {
    try {
      const buyerId = req.user._id;

      const listing = await Marketplace.findById(req.params.id);
      if (!listing) {
        return res.status(404).json({ message: "Item not found" });
      }

      if (req.user.level < 10) {
        return res.status(400).json({ message: "You must be at least level 10 to buy items" });
      }

      if (listing.sellerId.toString() === buyerId.toString()) {
        return res.status(400).json({ message: "You can't buy your own listing" });
      }

      // atomically claim the listing so two buyers can't both purchase it
      const claimed = await Marketplace.findOneAndDelete({ _id: listing._id });
      if (!claimed) {
        return res.status(404).json({ message: "Item no longer available" });
      }

      const inventoryItem = {
        _id: claimed.item,
        name: claimed.itemName,
        image: claimed.itemImage,
        rarity: claimed.rarity,
        case: claimed.case,
        createdAt: new Date(), // acquired now, so it sorts as newest
        uniqueId: claimed.uniqueId,
      };

      // atomically debit the buyer and grant the item only if the balance covers it
      const updatedBuyer = await User.findOneAndUpdate(
        { _id: buyerId, walletBalance: { $gte: claimed.price } },
        { $inc: { walletBalance: -claimed.price }, $push: { inventory: inventoryItem } },
        { new: true }
      );

      if (!updatedBuyer) {
        // payment failed: put the listing back on the market
        await Marketplace.create({
          sellerId: claimed.sellerId,
          item: claimed.item,
          case: claimed.case,
          uniqueId: claimed.uniqueId,
          price: claimed.price,
          itemName: claimed.itemName,
          itemImage: claimed.itemImage,
          rarity: claimed.rarity,
        });
        return res.status(400).json({ message: "Insufficient balance" });
      }

      await recordTransaction({
        userId: buyerId,
        type: TX.MARKET_BUY,
        direction: "debit",
        amount: claimed.price,
        balanceAfter: updatedBuyer.walletBalance,
        meta: { itemName: claimed.itemName, sellerId: claimed.sellerId, listingId: claimed.uniqueId },
      });

      // pay the seller through the ledger chokepoint (records the sale proceeds)
      const seller = await creditUser(claimed.sellerId, claimed.price, 0, {
        type: TX.MARKET_SALE,
        meta: { itemName: claimed.itemName, buyerId, listingId: claimed.uniqueId },
      });

      // seller account is gone: reverse the buyer so their KP can't disappear
      if (!seller) {
        const reversed = await User.findOneAndUpdate(
          { _id: buyerId },
          { $inc: { walletBalance: claimed.price }, $pull: { inventory: { uniqueId: claimed.uniqueId } } },
          { new: true }
        );
        await recordTransaction({
          userId: buyerId,
          type: TX.MARKET_BUY,
          direction: "credit",
          amount: claimed.price,
          balanceAfter: reversed ? reversed.walletBalance : undefined,
          meta: { itemName: claimed.itemName, reversal: true, reason: "seller no longer exists" },
        });
        return res.status(410).json({ message: "Seller no longer available; purchase reversed" });
      }

      res.json({ message: "Item purchased" });

      // notify the seller after responding; failures here must not re-send headers
      try {
        if (seller) {
          const newNotification = new Notification({
            senderId: buyerId,
            receiverId: seller._id,
            type: 'message',
            title: 'Item Sold',
            content: `Your ${claimed.itemName} has been sold for K₽${claimed.price}`,
          });
          await newNotification.save();

          io.to(seller._id.toString()).emit("newNotification", {
            message: `Your ${claimed.itemName} has been sold for K₽${claimed.price}`
          });

          io.to(seller._id.toString()).emit('userDataUpdated', {
            walletBalance: seller.walletBalance,
            xp: seller.xp,
            level: seller.level,
          });
        }
      } catch (notifyErr) {
        console.error(notifyErr);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return router;
};
