const express = require("express");
const router = express.Router();
const { isAuthenticated, isAdmin } = require("../middleware/authMiddleware");
const User = require("../models/User");
const Case = require("../models/Case");
const Item = require("../models/Item");
const { recomputeCaseValues } = require("../utils/itemValue");
const { recordTransaction, runAtomic, TX } = require("../utils/economy");
const adminStats = require("../utils/adminStats");

// the backoffice dashboard: everything is derived from the ledger, ?days= windows it
router.get("/stats/overview", isAuthenticated, isAdmin, async (req, res) => {
  try {
    res.json(await adminStats.overview(req.query.days));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/stats/games", isAuthenticated, isAdmin, async (req, res) => {
  try {
    res.json(await adminStats.gameStats(req.query.days));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/stats/cases", isAuthenticated, isAdmin, async (req, res) => {
  try {
    res.json(await adminStats.caseStats(req.query.days));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/stats/users", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { days, page, search, sort } = req.query;
    res.json(await adminStats.userStats({ days, page, search, sort }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/stats/timeseries", isAuthenticated, isAdmin, async (req, res) => {
  try {
    res.json(await adminStats.timeseries(req.query.days));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/stats/wins", isAuthenticated, isAdmin, async (req, res) => {
  try {
    res.json(await adminStats.bigWins(req.query.days));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/stats/users/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const detail = await adminStats.playerDetail(req.params.id, req.query.days);
    if (!detail) return res.status(404).json({ message: "User not found" });
    res.json(detail);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/users", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

//create case
router.post("/cases", isAuthenticated, isAdmin, async (req, res) => {
  const { title, image, price, items, category } = req.body;
  const newCase = new Case({ title, image, price, items, category });

  try {
    const savedCase = await newCase.save();
    await recomputeCaseValues(savedCase._id);
    res.status(201).json(savedCase);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

//update case
router.put("/cases/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const updatedCase = await Case.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updatedCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    await recomputeCaseValues(updatedCase._id);
    res.json(updatedCase);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

//delete case
router.delete("/cases/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const deletedCase = await Case.findByIdAndDelete(req.params.id);

    if (!deletedCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    res.json({ message: "Case deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

//new item
router.post("/items", isAuthenticated, isAdmin, async (req, res) => {
  const { name, description, rarity, image } = req.body;
  const newItem = new Item({ name, description, rarity, image });

  try {
    const savedItem = await newItem.save();
    res.status(201).json(savedItem);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

//update item
router.put("/items/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const updatedItem = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (updatedItem.case) {
      await recomputeCaseValues(updatedItem.case);
    }
    res.json(updatedItem);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

//delete item
router.delete("/items/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const deletedItem = await Item.findByIdAndDelete(req.params.id);

    if (!deletedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (deletedItem.case) {
      await Case.updateOne({ _id: deletedItem.case }, { $pull: { items: deletedItem._id } });
      await recomputeCaseValues(deletedItem.case);
    }
    res.json({ message: "Item deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

//update wallet balance
router.put("/users/:id/wallet", isAuthenticated, isAdmin, async (req, res) => {
  const { walletBalance } = req.body;

  if (typeof walletBalance !== "number" || !Number.isFinite(walletBalance) || walletBalance < 0) {
    return res.status(400).json({ message: "walletBalance must be a non-negative number" });
  }

  try {
    // set the balance and record the adjustment together, computing the delta inside the
    // transaction so two concurrent admin sets cannot clobber each other or mis-record
    const result = await runAtomic(async (session) => {
      const user = await User.findById(req.params.id).session(session);
      if (!user) return { notFound: true };

      const previous = user.walletBalance;
      const delta = walletBalance - previous;
      user.walletBalance = walletBalance;
      await user.save({ session });

      if (delta !== 0) {
        await recordTransaction(
          {
            userId: user._id,
            type: TX.ADMIN_ADJUST,
            direction: delta > 0 ? "credit" : "debit",
            amount: Math.abs(delta),
            balanceAfter: user.walletBalance,
            meta: { adminId: req.user._id, previous },
          },
          session
        );
      }
      return { balance: user.walletBalance };
    });

    if (result.notFound) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.balance);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

//update inventory
router.put(
  "/users/:id/inventory",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    const { inventory } = req.body;

    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.inventory = inventory;
      await user.save();

      res.json(user.inventory);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

module.exports = router;
