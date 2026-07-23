const express = require("express");
const router = express.Router();
const Case = require("../models/Case");
const Item = require("../models/Item");
const Transaction = require("../models/Transaction");
const { isAuthenticated, isAdmin } = require("../middleware/authMiddleware");
const { recomputeCaseValues } = require("../utils/itemValue");
const { TX } = require("../utils/economy");
const { publicCache, TTL } = require("../utils/httpCache");

router.get("/", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    // escape regex metacharacters so search is a literal, injection/ReDoS-safe match
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = q ? { title: { $regex: safe, $options: "i" } } : {};
    // the committed range table is one entry per item and no listing consumer reads it
    const cases = await Case.find(filter).select('-items -rangeTable');
    publicCache(res, TTL.caseList);
    res.json(cases);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", isAuthenticated, isAdmin, async (req, res) => {
  const newCase = new Case({
    title: req.body.title,
    image: req.body.image,
    price: req.body.price,
    items: req.body.items,
    category: req.body.category,
  });

  try {
    const savedCase = await newCase.save();
    await recomputeCaseValues(savedCase._id);
    res.status(201).json(savedCase);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /cases/most-opened?limit=5 : the case ledger counted by opens, most first.
// must stay registered before the /:id catch-all.
router.get("/most-opened", async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
    const rows = await Transaction.aggregate([
      { $match: { type: TX.CASE_OPEN, "meta.caseId": { $ne: null } } },
      {
        $group: {
          _id: "$meta.caseId",
          opens: { $sum: { $max: [{ $ifNull: ["$meta.quantity", 1] }, 1] } },
        },
      },
      { $sort: { opens: -1 } },
      { $limit: limit },
    ]);

    // a case can be deleted after being opened; drop those rather than render a hole
    const cases = await Case.find({ _id: { $in: rows.map((r) => r._id) } })
      .select("-items -rangeTable")
      .lean();
    const byId = new Map(cases.map((c) => [String(c._id), c]));
    const out = rows
      .filter((r) => byId.has(String(r._id)))
      .map((r) => ({ ...byId.get(String(r._id)), opens: r.opens }));

    publicCache(res, TTL.caseList);
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const caseData = await Case.findById(req.params.id)
      .select("-rangeTable")
      .populate({
        path: "items",
        options: { sort: { rarity: -1 } },
      });
    publicCache(res, TTL.caseDetail);
    res.json(caseData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const updatedCase = await Case.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (updatedCase) {
      await recomputeCaseValues(updatedCase._id); // price/items may have changed
    }
    res.json(updatedCase);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    await Case.findByIdAndDelete(req.params.id);
    res.json({ message: "Case deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
