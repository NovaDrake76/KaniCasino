const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");

const User = require("../models/User");
const Item = require("../models/Item");
const Marketplace = require("../models/Marketplace");
const MarketSale = require("../models/MarketSale");
const BuyOrder = require("../models/BuyOrder");
const { chargeUser, creditUser, TX } = require("../utils/economy");
const { sellValue, marketFee, sellerNet, MARKET_FEE_RATE } = require("../utils/itemValue");
const market = require("../utils/market");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const MAX_PRICE = 1000000;
const MAX_ORDER_QTY = 20;
const SELL_LEVEL = 5;
const BUY_LEVEL = 10;

// prices are whole KP; floor rather than reject so a client sending 10.5 is not a hard error
const cleanPrice = (raw) => {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 && n <= MAX_PRICE ? n : null;
};

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

// bucket size per range: enough points to read a trend without shipping every sale
const RANGES = {
  week: { days: 7, bucketMs: 6 * 3600 * 1000 },
  month: { days: 30, bucketMs: 24 * 3600 * 1000 },
  year: { days: 365, bucketMs: 7 * 24 * 3600 * 1000 },
  lifetime: { days: null, bucketMs: 7 * 24 * 3600 * 1000 },
};

// aggregate raw sales into time buckets. $toLong/$toDate keep this compatible with
// mongo 4.x (no $dateTrunc), and the median is computed here since mongo has none.
async function salesSeries(itemId, since, bucketMs) {
  const match = { item: new mongoose.Types.ObjectId(String(itemId)) };
  if (since) match.soldAt = { $gte: since };
  const rows = await MarketSale.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $toDate: {
            $subtract: [{ $toLong: "$soldAt" }, { $mod: [{ $toLong: "$soldAt" }, bucketMs] }],
          },
        },
        volume: { $sum: 1 },
        avg: { $avg: "$price" },
        min: { $min: "$price" },
        max: { $max: "$price" },
        prices: { $push: "$price" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({
    t: r._id,
    volume: r.volume,
    avg: Math.round(r.avg),
    min: r.min,
    max: r.max,
    median: median(r.prices),
  }));
}

module.exports = (io) => {
  // ---------------------------------------------------------------- listings

  // Create new listing. if a resting buy order already bids at or above the asking
  // price, the item sells instantly at that (better) bid.
  router.post("/", isAuthenticated, async (req, res) => {
    try {
      const { item: uniqueId } = req.body;
      const price = cleanPrice(req.body.price);
      if (price === null) {
        return res.status(400).json({ message: "Invalid price" });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.level < SELL_LEVEL) {
        return res.status(400).json({ message: `You must be at least level ${SELL_LEVEL} to sell items` });
      }

      const inventoryItem = user.inventory.find((item) => item.uniqueId === uniqueId);
      if (!inventoryItem) {
        return res.status(404).json({ message: "Item not found in inventory" });
      }

      const itemDocument = await Item.findById(inventoryItem._id);
      if (!itemDocument) {
        return res.status(404).json({ message: "Item not found" });
      }

      // atomically remove exactly this item; if it's already gone, abort without listing
      const pull = await User.updateOne({ _id: user._id }, { $pull: { inventory: { uniqueId } } });
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

      // cross against the best resting bid, if any
      const order = await market.findMatchingOrder({
        itemId: itemDocument._id,
        price,
        excludeUserId: user._id,
      });
      if (order) {
        const filled = await market.fillListingWithOrder({ listing: marketplaceItem, order, io });
        if (filled.ok) {
          return res.json({
            ...marketplaceItem.toObject(),
            soldInstantly: true,
            soldFor: filled.price,
            received: sellerNet(filled.price),
          });
        }
      }

      res.json(marketplaceItem);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Browse items on the market
  router.get("/", async (req, res) => {
    try {
      const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
      const limit = Math.min(Math.max(1, Math.floor(Number(req.query.limit)) || 30), 100);
      const skip = (page - 1) * limit;
      const { name, rarity, sortBy, order, listedOnly } = req.query;

      const itemFilter = {};
      if (name) itemFilter.name = { $regex: new RegExp(escapeRegex(String(name)), "i") };
      if (rarity) itemFilter.rarity = rarity;

      const items = await Item.find(itemFilter).exec();
      const itemIds = items.map((item) => item._id);

      const marketplaceData = await Marketplace.aggregate([
        { $match: { item: { $in: itemIds } } },
        {
          $group: {
            _id: "$item",
            cheapestPrice: { $min: "$price" },
            totalListings: { $sum: 1 },
            mostRecent: { $max: "$createdAt" },
          },
        },
      ]);
      const byItem = new Map(marketplaceData.map((m) => [m._id.toString(), m]));

      let rows = items.map((item) => {
        const md = byItem.get(item._id.toString());
        return {
          ...item.toObject(),
          sellValue: sellValue(item.baseValue),
          cheapestPrice: md ? md.cheapestPrice : null,
          totalListings: md ? md.totalListings : 0,
          mostRecent: md ? md.mostRecent : new Date(0),
        };
      });

      if (listedOnly === "1" || listedOnly === "true") {
        rows = rows.filter((r) => r.totalListings > 0);
      }

      // whitelisted sort (these params used to be accepted and silently ignored)
      const dir = order === "asc" ? 1 : -1;
      const listedFirst = (a, b) => (b.totalListings > 0) - (a.totalListings > 0);
      const comparators = {
        price: (a, b) => {
          const av = a.cheapestPrice ?? Infinity;
          const bv = b.cheapestPrice ?? Infinity;
          return (av - bv) * (order === "desc" ? -1 : 1);
        },
        name: (a, b) => String(a.name).localeCompare(String(b.name)) * (order === "desc" ? -1 : 1),
        listings: (a, b) => (a.totalListings - b.totalListings) * dir,
        rarity: (a, b) => (Number(a.rarity) - Number(b.rarity)) * dir,
        recent: (a, b) => (new Date(a.mostRecent) - new Date(b.mostRecent)) * dir,
      };
      const cmp = comparators[String(sortBy)] || comparators.recent;
      rows.sort((a, b) => listedFirst(a, b) || cmp(a, b));

      res.json({
        totalPages: Math.max(1, Math.ceil(rows.length / limit)),
        currentPage: page,
        items: rows.slice(skip, skip + limit),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ------------------------------------------------------------ buy orders
  // (registered before /:id so "orders" is never read as a listing id)

  // my open buy orders
  router.get("/orders/me", isAuthenticated, async (req, res) => {
    try {
      const orders = await BuyOrder.find({ userId: req.user._id, status: "open" }).sort({ createdAt: -1 });
      res.json({ orders });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // place a buy order: fill instantly from the cheapest listings at or below the bid,
  // then escrow the remainder so a later match can never fail for lack of funds.
  router.post("/orders", isAuthenticated, async (req, res) => {
    try {
      const { itemId } = req.body;
      const price = cleanPrice(req.body.price);
      const quantity = Math.floor(Number(req.body.quantity) || 1);

      if (!isValidId(itemId)) return res.status(400).json({ message: "Invalid item" });
      if (price === null) return res.status(400).json({ message: "Invalid price" });
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_ORDER_QTY) {
        return res.status(400).json({ message: `Quantity must be between 1 and ${MAX_ORDER_QTY}` });
      }
      if (req.user.level < BUY_LEVEL) {
        return res.status(400).json({ message: `You must be at least level ${BUY_LEVEL} to buy items` });
      }

      const itemDoc = await Item.findById(itemId);
      if (!itemDoc) return res.status(404).json({ message: "Item not found" });

      let filled = 0;
      let spent = 0;
      let ranOutOfFunds = false;
      for (let i = 0; i < quantity; i++) {
        const listing = await Marketplace.findOne({
          item: itemDoc._id,
          price: { $lte: price },
          sellerId: { $ne: req.user._id },
        }).sort({ price: 1 });
        if (!listing) break;

        const r = await market.purchaseListing({ listingId: listing._id, buyerId: req.user._id, io });
        if (r.ok) {
          filled += 1;
          spent += r.price;
          continue;
        }
        if (r.code === 400) {
          ranOutOfFunds = true; // insufficient balance
          break;
        }
        // 404 (someone else took it) or 410 (seller vanished): try the next listing
      }

      const remaining = quantity - filled;
      if (remaining > 0 && !ranOutOfFunds) {
        const escrow = remaining * price;
        const charged = await chargeUser(req.user._id, escrow, {
          awardXp: false,
          type: TX.MARKET_ORDER,
          meta: { itemId: itemDoc._id, itemName: itemDoc.name, price, quantity: remaining },
        });
        if (charged) {
          const order = await BuyOrder.create({
            userId: req.user._id,
            item: itemDoc._id,
            itemName: itemDoc.name,
            itemImage: itemDoc.image,
            rarity: itemDoc.rarity,
            case: itemDoc.case,
            price,
            quantity: remaining,
            filled: 0,
            escrow,
            status: "open",
          });
          io.to(req.user._id.toString()).emit("userDataUpdated", {
            walletBalance: charged.walletBalance,
            xp: charged.xp,
            level: charged.level,
          });
          return res.json({ filled, spent, order });
        }
        if (filled === 0) {
          return res.status(400).json({ message: "Insufficient balance" });
        }
        // bought what we could afford, could not escrow the rest
        return res.json({ filled, spent, order: null, message: "Not enough balance to hold the rest" });
      }

      if (filled === 0) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      res.json({ filled, spent, order: null });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // cancel an order and refund whatever escrow is still held. the status guard in the
  // filter means a concurrent fill and a cancel can never both spend the same KP.
  router.delete("/orders/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ message: "Order not found" });

      const order = await BuyOrder.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id, status: "open" },
        { $set: { status: "cancelled", escrow: 0 } },
        { returnDocument: "before" } // pre-image holds the exact escrow to refund
      );
      if (!order) return res.status(404).json({ message: "Order not found" });

      const refund = order.escrow || 0;
      if (refund > 0) {
        const user = await creditUser(req.user._id, refund, 0, {
          type: TX.MARKET_ORDER_REFUND,
          meta: { orderId: order._id, itemName: order.itemName },
        });
        if (user) {
          io.to(req.user._id.toString()).emit("userDataUpdated", {
            walletBalance: user.walletBalance,
            xp: user.xp,
            level: user.level,
          });
        }
      }
      res.json({ message: "Order cancelled", refunded: refund });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ------------------------------------------------------------- item views

  // the price-history series + everything a seller needs to price an item
  router.get("/item/:itemId/history", async (req, res) => {
    try {
      const { itemId } = req.params;
      if (!isValidId(itemId)) return res.status(404).json({ message: "Item not found" });

      const rangeKey = RANGES[String(req.query.range)] ? String(req.query.range) : "week";
      const { days, bucketMs } = RANGES[rangeKey];
      const since = days ? new Date(Date.now() - days * 24 * 3600 * 1000) : null;

      const item = await Item.findById(itemId, { name: 1, image: 1, rarity: 1, baseValue: 1, case: 1 });
      if (!item) return res.status(404).json({ message: "Item not found" });

      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

      const [points, cheapest, totalListings, lastSale, recent7, recent30, bestBid] = await Promise.all([
        salesSeries(itemId, since, bucketMs),
        Marketplace.findOne({ item: itemId }).sort({ price: 1 }).select("price"),
        Marketplace.countDocuments({ item: itemId }),
        MarketSale.findOne({ item: itemId }).sort({ soldAt: -1 }).select("price soldAt"),
        MarketSale.find({ item: itemId, soldAt: { $gte: weekAgo } }).select("price"),
        MarketSale.find({ item: itemId, soldAt: { $gte: monthAgo } }).select("price"),
        BuyOrder.findOne({ item: itemId, status: "open", $expr: { $lt: ["$filled", "$quantity"] } })
          .sort({ price: -1 })
          .select("price"),
      ]);

      const prices7 = recent7.map((s) => s.price);
      const prices30 = recent30.map((s) => s.price);

      res.json({
        item: {
          _id: item._id,
          name: item.name,
          image: item.image,
          rarity: item.rarity,
          baseValue: item.baseValue || 0,
        },
        range: rangeKey,
        points,
        stats: {
          floor: sellValue(item.baseValue), // the house always pays this: a hard price floor
          lowestListing: cheapest ? cheapest.price : null,
          totalListings,
          bestBid: bestBid ? bestBid.price : null,
          lastSale: lastSale ? { price: lastSale.price, soldAt: lastSale.soldAt } : null,
          median7d: prices7.length ? median(prices7) : null,
          median30d: prices30.length ? median(prices30) : null,
          volume7d: prices7.length,
          volume30d: prices30.length,
          feeRate: MARKET_FEE_RATE,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // the buy-order book for an item, aggregated by price
  router.get("/item/:itemId/orders", async (req, res) => {
    try {
      const { itemId } = req.params;
      if (!isValidId(itemId)) return res.status(404).json({ message: "Item not found" });
      const rows = await BuyOrder.aggregate([
        {
          $match: {
            item: new mongoose.Types.ObjectId(String(itemId)),
            status: "open",
            $expr: { $lt: ["$filled", "$quantity"] },
          },
        },
        { $group: { _id: "$price", quantity: { $sum: { $subtract: ["$quantity", "$filled"] } } } },
        { $sort: { _id: -1 } },
        { $limit: 20 },
      ]);
      res.json({ orders: rows.map((r) => ({ price: r._id, quantity: r.quantity })) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get listings for a specific item
  router.get("/item/:itemId", async (req, res) => {
    try {
      const { itemId } = req.params;
      if (!isValidId(itemId)) {
        return res.status(404).json({ message: "Item not found" });
      }

      const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
      const limit = Math.min(Math.max(1, Math.floor(Number(req.query.limit)) || 30), 100);
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
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ------------------------------------------------------------------ trade

  // Delete listing (id here is the listing's uniqueId)
  router.delete("/:id", isAuthenticated, async (req, res) => {
    try {
      const item = await Marketplace.findOneAndDelete({
        uniqueId: req.params.id,
        sellerId: req.user._id,
      });
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      await User.updateOne(
        { _id: req.user._id },
        { $push: { inventory: market.inventoryEntryFrom(item) } }
      );

      res.json({ message: "Item removed" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Buy a listing outright (id here is the listing's _id)
  router.post("/buy/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(404).json({ message: "Item not found" });
      }
      if (req.user.level < BUY_LEVEL) {
        return res.status(400).json({ message: `You must be at least level ${BUY_LEVEL} to buy items` });
      }

      const result = await market.purchaseListing({
        listingId: req.params.id,
        buyerId: req.user._id,
        io,
      });
      if (!result.ok) {
        return res.status(result.code).json({ message: result.message });
      }
      res.json({ message: "Item purchased", price: result.price, walletBalance: result.buyer.walletBalance });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return router;
};
