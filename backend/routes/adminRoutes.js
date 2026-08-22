const express = require("express");
const router = express.Router();
const { isAuthenticated, isAdmin } = require("../middleware/authMiddleware");
const badges = require("../utils/badges");
const nameFilter = require("../utils/nameFilter");
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
// hand out or take back a badge. only the grantable ones: the earned badges are owned by
// the code that awards them and would be overwritten anyway.
router.put("/users/:id/badge", isAuthenticated, isAdmin, async (req, res) => {
  const { key, note, action } = req.body;
  if (!badges.GRANTABLE.includes(key)) {
    return res.status(400).json({ message: "That badge is earned, not granted" });
  }
  // written by an admin, but it sits on a public profile
  if (note && nameFilter.findSlur(note)) {
    return res.status(400).json({ message: "Please write something else" });
  }
  try {
    const user = await User.findById(req.params.id).select("_id");
    if (!user) return res.status(404).json({ message: "User not found" });

    const result =
      action === "revoke"
        ? await badges.revoke(user._id, key)
        : await badges.grant(user._id, key, note);
    if (!result.ok) return res.status(400).json({ message: result.message });

    const after = await User.findById(user._id).select("fanRank badges selectedBadge").lean();
    res.json({ badges: badges.heldBadges(after) });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

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

// ---- prediction markets ----

const Prediction = require("../models/Prediction");
const PredictionPosition = require("../models/PredictionPosition");
const settlement = require("../utils/predictionSettlement");
const { DEFAULT_VIG_BPS, DEFAULT_IMPACT_BPS } = require("../utils/predictionMath");

const slugify = (title) =>
  String(title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

// a market the admin writes is still text a player reads, so it goes through the filter
function cleanText(...parts) {
  const hit = parts.filter(Boolean).map((t) => nameFilter.findSlur(String(t))).find(Boolean);
  return hit || null;
}

router.get("/predictions", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const rows = await Prediction.find(req.query.status ? { status: req.query.status } : {})
      .sort({ status: 1, createdAt: -1 })
      .limit(200)
      .lean();
    const exposure = rows.map((r) => ({
      ...r,
      // the worst case, which is the number worth looking at on this screen
      worstCase: Math.max(0, ...r.outcomes.map((o) => o.shares)),
    }));
    res.json({ predictions: exposure });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/predictions", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { title, description, image, category, endsAt, outcomes, vigBps, impactBps, exposureCap, boardOrder } = req.body;
    if (!title || !Array.isArray(outcomes) || outcomes.length < 2) {
      return res.status(400).json({ message: "A market needs a title and at least two outcomes" });
    }
    if (outcomes.length > 8) return res.status(400).json({ message: "A market takes at most eight outcomes" });

    const labels = outcomes.map((o) => (typeof o === "string" ? o : o.label)).filter(Boolean);
    if (labels.length !== outcomes.length) return res.status(400).json({ message: "Every outcome needs a label" });

    const dirty = cleanText(title, description, ...labels);
    if (dirty) return res.status(400).json({ message: "That wording is not allowed" });

    const vig = Number.isFinite(Number(vigBps)) ? Math.max(0, Math.min(3000, Number(vigBps))) : DEFAULT_VIG_BPS;
    const base = slugify(title) || "market";
    let slug = base;
    for (let n = 2; await Prediction.exists({ slug }); n++) slug = `${base}-${n}`;

    const prediction = await Prediction.create({
      slug,
      title,
      description: description || "",
      image,
      category: category || "General",
      endsAt: endsAt ? new Date(endsAt) : undefined,
      outcomes: Prediction.openBook(outcomes, vig),
      vigBps: vig,
      impactBps: Number(impactBps) > 0 ? Number(impactBps) : DEFAULT_IMPACT_BPS,
      exposureCap: Number(exposureCap) > 0 ? Number(exposureCap) : undefined,
      boardOrder: Number.isFinite(Number(boardOrder)) ? Number(boardOrder) : 0,
      createdBy: req.user._id,
    });
    res.status(201).json(prediction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// only the wording, the clock and the cap. prices and outcomes belong to the traders now.
// impact is the exception: it is the shape of the curve everyone has already traded against,
// so it can only be changed while nobody has, which is the window where a first market's
// number turns out to be wrong.
router.put("/predictions/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { title, description, image, category, endsAt, exposureCap, impactBps, boardOrder } = req.body;
    const dirty = cleanText(title, description);
    if (dirty) return res.status(400).json({ message: "That wording is not allowed" });

    const set = {};
    if (title) set.title = title;
    if (description !== undefined) set.description = description;
    if (image !== undefined) set.image = image;
    if (category) set.category = category;
    if (endsAt !== undefined) set.endsAt = endsAt ? new Date(endsAt) : null;
    if (Number(exposureCap) > 0) set.exposureCap = Number(exposureCap);
    if (boardOrder !== undefined && Number.isFinite(Number(boardOrder))) set.boardOrder = Number(boardOrder);

    const current = await Prediction.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "That market does not exist" });
    if (Number(impactBps) > 0 && Number(impactBps) !== current.impactBps) {
      if (current.volume > 0) {
        return res.status(400).json({ message: "This market has been traded, its price impact is fixed now" });
      }
      set.impactBps = Number(impactBps);
    }

    const prediction = await Prediction.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
    res.json(prediction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/predictions/:id/close", isAuthenticated, isAdmin, async (req, res) => {
  const result = await settlement.closeMarket(req.params.id);
  if (result.error) return res.status(400).json({ message: result.error });
  res.json(result.prediction);
});

router.post("/predictions/:id/reopen", isAuthenticated, isAdmin, async (req, res) => {
  const result = await settlement.reopenMarket(req.params.id);
  if (result.error) return res.status(400).json({ message: result.error });
  res.json(result.prediction);
});

module.exports = router;

// resolving pays people, and paying people has to reach their sockets. index.js hands the
// io instance over once at boot; the rest of this router never needed it.
let settlementAttached = false;
module.exports.attachPredictionSettlement = (io) => {
  if (settlementAttached) return;
  settlementAttached = true;

  router.post("/predictions/:id/resolve", isAuthenticated, isAdmin, async (req, res) => {
    const result = await settlement.resolveMarket({
      predictionId: req.params.id,
      outcomeKey: req.body.outcome,
      adminId: req.user._id,
      note: req.body.note,
      io,
    });
    if (result.error) return res.status(400).json({ message: result.error });
    res.json(result);
  });

  router.post("/predictions/:id/void", isAuthenticated, isAdmin, async (req, res) => {
    const result = await settlement.voidMarket({
      predictionId: req.params.id,
      adminId: req.user._id,
      note: req.body.note,
      io,
    });
    if (result.error) return res.status(400).json({ message: result.error });
    res.json(result);
  });
};
