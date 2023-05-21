const express = require("express");
const router = express.Router();
const Item = require("../models/Item");
const Case = require("../models/Case");
const { isAuthenticated, isAdmin } = require("../middleware/authMiddleware");

router.get("/", async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    res.json(updateItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
