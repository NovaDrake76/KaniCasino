const express = require("express");
const router = express.Router();
const MarketplaceItem = require("../models/marketplaceItem");
const { isAuthenticated } = require("../middleware/authMiddleware");

router.get("/", async (req, res) => {
  try {
    const items = await MarketplaceItem.find()
      .populate("item")
      .populate("seller");
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", isAuthenticated, async (req, res) => {
  const { item, price } = req.body;

  const newMarketplaceItem = new MarketplaceItem({
    item,
    seller: req.user._id,
    price,
  });

  try {
    const savedMarketplaceItem = await newMarketplaceItem.save();
    res.status(201).json(savedMarketplaceItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/buy/:id", isAuthenticated, async (req, res) => {
  try {
    const marketplaceItem = await MarketplaceItem.findById(req.params.id)
      .populate("item")
      .populate("seller");
    if (!marketplaceItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Implement the necessary logic to update the buyer's and seller's wallet balances and inventory.
    // For example, check if the buyer has enough CP, update wallet balances, and transfer the item to the buyer's inventory.
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", async (req, res) => {
  // Get query parameters from the request, e.g., req.query.price, req.query.rarity, req.query.name
  // Modify the MongoDB query based on the query parameters.
  // For example, you can use .find() with conditions and .sort() to filter and sort the results.

  try {
    let query = MarketplaceItem.find().populate("item").populate("seller");

    if (req.query.price) {
      query = query.where("price").lte(req.query.price);
    }

    if (req.query.rarity) {
      query = query.where("item.rarity").equals(req.query.rarity);
    }

    if (req.query.name) {
      query = query.where("item.name").regex(new RegExp(req.query.name, "i"));
    }

    const items = await query.exec();

    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
