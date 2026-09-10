const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const beta = require("../utils/beta");
const pot = require("../utils/pot");
const { dayIndex } = require("../utils/dailyGift");
const { runAtomic, recordTransaction, WITHOUT_INVENTORY, TX } = require("../utils/economy");

const gate = [authMiddleware.isAuthenticated, beta.requireFlag("daisu")];

// everything the dock needs to draw the pot and tick it locally until the next claim
const statusOf = (user, now = new Date()) => {
  const fill = pot.fillAt(user.nextBonus, now);
  return {
    fill,
    full: user.bonusAmount,
    amount: pot.payout(user.bonusAmount, fill),
    fullAt: new Date(user.nextBonus).toISOString(),
    floor: pot.FLOOR,
    cycleMs: pot.CYCLE_MS,
    creditShare: pot.CREDIT_SHARE,
    pick: pot.pickFor(dayIndex(now)),
    credits: pot.creditsOf(user),
  };
};

router.get("/status", ...gate, (req, res) => {
  res.json(statusOf(req.user));
});

router.post("/claim", ...gate, async (req, res) => {
  try {
    const now = new Date();
    const fill = pot.fillAt(req.user.nextBonus, now);
    if (fill < pot.FLOOR) {
      return res.status(400).json({
        message: "The pot is empty",
        reason: "empty",
        fill,
        floorAt: pot.floorAt(req.user.nextBonus).toISOString(),
      });
    }

    const amount = pot.payout(req.user.bonusAmount, fill);
    const credit = pot.creditOf(amount);
    const pick = pot.pickFor(dayIndex(now));
    const nextBonus = new Date(now.getTime() + pot.CYCLE_MS);

    // the stored nextBonus is the version the claim was priced against: a second click
    // that lands after the first sees a different one and pays nothing
    const updated = await runAtomic(async (session) => {
      const inc = { walletBalance: amount };
      if (credit > 0) inc[`gameCredits.${pick}`] = credit;
      const u = await User.findOneAndUpdate(
        { _id: req.user._id, nextBonus: req.user.nextBonus },
        { $inc: inc, $set: { nextBonus, bonusAmount: pot.fullAmount(req.user.level) } },
        { new: true, projection: WITHOUT_INVENTORY, session }
      );
      if (!u) return null;
      await recordTransaction(
        { userId: req.user._id, type: TX.BONUS, direction: "credit", amount, balanceAfter: u.walletBalance, meta: { fill: Number(fill.toFixed(3)) } },
        session
      );
      if (credit > 0) {
        await recordTransaction(
          { userId: req.user._id, type: TX.GAME_CREDIT, direction: "credit", amount: credit, balanceAfter: u.walletBalance, meta: { game: pick } },
          session
        );
      }
      return u;
    });

    if (!updated) {
      return res.status(409).json({ message: "That claim already went through", reason: "raced" });
    }

    res.json({
      amount,
      credit,
      pick,
      fill,
      walletBalance: updated.walletBalance,
      nextBonus: updated.nextBonus,
      status: statusOf(updated, now),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
