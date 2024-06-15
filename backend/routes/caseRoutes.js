const express = require("express");
const router = express.Router();
const Case = require("../models/Case");
const Item = require("../models/Item");
const { isAuthenticated, isAdmin } = require("../middleware/authMiddleware");

router.get("/", async (req, res) => {
  try {
    const cases = await Case.find().select('-items');
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
  });

  try {
    const savedCase = await newCase.save();
    res.status(201).json(savedCase);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const caseData = await Case.findById(req.params.id).populate({
      path: "items",
      options: { sort: { rarity: -1 } },
    });
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
