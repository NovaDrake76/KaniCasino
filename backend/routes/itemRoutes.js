const express = require("express");
const router = express.Router();
const Item = require("../models/Item");
const Case = require("../models/Case");
const { isAuthenticated, isAdmin } = require("../middleware/authMiddleware");
const { recomputeCaseValues } = require("../utils/itemValue");
const { publicCache, TTL } = require("../utils/httpCache");
const itemCatalog = require("../utils/itemCatalog");
const artProxy = require("../utils/artProxy");
const { artLimiter } = require("../middleware/rateLimit");

router.get("/", async (req, res) => {
  try {
    const items = await itemCatalog.all();
    publicCache(res, TTL.itemList);
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// the share card needs the pixels, not just the picture: steam's cdn serves item art
// without a cors header, so a canvas that drew it straight could never be exported
router.get("/art", isAuthenticated, artLimiter, async (req, res) => {
  const target = artProxy.allow(req.query.url);
  if (!target) return res.status(400).json({ message: "That image is not served from here" });

  try {
    const upstream = await fetch(target, { signal: AbortSignal.timeout(artProxy.TIMEOUT_MS) });
    const type = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !type.startsWith("image/")) {
      return res.status(502).json({ message: "That artwork could not be fetched" });
    }
    if (artProxy.tooBig(upstream.headers.get("content-length"))) {
      return res.status(502).json({ message: "That artwork is too large" });
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.length > artProxy.MAX_BYTES) {
      return res.status(502).json({ message: "That artwork is too large" });
    }
    res.set("Content-Type", type);
    res.set("Cache-Control", `public, max-age=${artProxy.CACHE_SECONDS}, immutable`);
    res.send(body);
  } catch {
    res.status(504).json({ message: "That artwork could not be fetched" });
  }
});

router.post("/", isAuthenticated, isAdmin, async (req, res) => {
  const newItem = new Item({
    name: req.body.name,
    image: req.body.image,
    rarity: req.body.rarity,
    case: req.body.case,
  });

  try {
    const savedItem = await newItem.save();

    // Find the case with the provided id
    const caseToUpdate = await Case.findById(req.body.case);
    if (!caseToUpdate) {
      return res.status(404).json({ message: "Case not found" });
    }

    // Push the saved item's id to the items array of the case
    caseToUpdate.items.push(savedItem._id);
    await caseToUpdate.save();

    // adding an item shifts the value of the whole case
    await recomputeCaseValues(caseToUpdate._id);

    res.status(201).json(savedItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const updateItem = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (updateItem && updateItem.case) {
      await recomputeCaseValues(updateItem.case);
    }
    res.json(updateItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (item && item.case) {
      // drop the dangling reference and revalue the case
      await Case.updateOne({ _id: item.case }, { $pull: { items: item._id } });
      await recomputeCaseValues(item.case);
    }
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
