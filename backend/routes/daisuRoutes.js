const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const beta = require("../utils/beta");
const pot = require("../utils/pot");
const { runAtomic, recordTransaction, WITHOUT_INVENTORY, TX } = require("../utils/economy");
const { potClaimLimiter } = require("../middleware/rateLimit");

const gate = [authMiddleware.isAuthenticated, beta.requireFlag("daisu")];

// everything the dock needs to draw the pot and tick it locally until the next take
const statusOf = (user, now = new Date()) => {
  const fill = pot.fillAt(user.nextBonus, now);
  const index = user.potPickIndex || 0;
  return {
    fill,
    full: user.bonusAmount,
    amount: pot.payout(user.bonusAmount, fill),
    fullAt: new Date(user.nextBonus).toISOString(),
    cycleMs: pot.CYCLE_MS,
    clickRate: pot.CLICK_RATE,
    fullBonus: pot.FULL_BONUS,
    creditShare: pot.CREDIT_SHARE,
    pick: pot.pickAt(index),
    nextPick: pot.pickAt(index + 1),
    pickProgress: user.bonusAmount > 0 ? Math.min(1, (user.potCycleClaimed || 0) / user.bonusAmount) : 0,
    credits: pot.creditsOf(user),
  };
};

router.get("/status", ...gate, (req, res) => {
  res.json(statusOf(req.user));
});

router.post("/claim", ...gate, potClaimLimiter, async (req, res) => {
  try {
    const now = new Date();
    const fill = pot.fillAt(req.user.nextBonus, now);
    const amount = pot.payout(req.user.bonusAmount, fill);
    if (amount < pot.MIN_CLAIM) {
      return res.status(400).json({
        message: "The pot is empty",
        reason: "empty",
        fill,
        readyAt: pot.readyAt(req.user.nextBonus, req.user.bonusAmount).toISOString(),
      });
    }

    const credit = pot.creditOf(amount);
    const pick = pot.pickAt(req.user.potPickIndex);
    const advanced = pot.advancePick(req.user.potPickIndex, req.user.potCycleClaimed, amount, req.user.bonusAmount);
    const nextBonus = new Date(now.getTime() + pot.CYCLE_MS);

    // the stored nextBonus is the version the take was priced against: a second request
    // that lands after the first sees a different one and pays nothing
    const updated = await runAtomic(async (session) => {
      const inc = { walletBalance: amount };
      if (credit > 0) inc[`gameCredits.${pick}`] = credit;
      const u = await User.findOneAndUpdate(
        { _id: req.user._id, nextBonus: req.user.nextBonus },
        {
          $inc: inc,
          $set: {
            nextBonus,
            bonusAmount: pot.fullAmount(req.user.level),
            potPickIndex: advanced.index,
            potCycleClaimed: advanced.cycleClaimed,
          },
        },
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
      return res.status(409).json({ message: "That take already went through", reason: "raced" });
    }

    res.json({
      amount,
      credit,
      pick,
      fill,
      pickChanged: advanced.index !== (req.user.potPickIndex || 0),
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
