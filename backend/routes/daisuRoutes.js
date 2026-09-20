const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const beta = require("../utils/beta");
const pot = require("../utils/pot");
const { runAtomic, recordTransaction, WITHOUT_INVENTORY, TX } = require("../utils/economy");
const { potClaimLimiter } = require("../middleware/rateLimit");
const roadmap = require("../utils/roadmap");
const shop = require("../utils/shop");
const { GOLDEN_TICKET_SHARE } = require("../utils/shopCatalog");

const gate = [authMiddleware.isAuthenticated, beta.requireFlag("daisu")];

// the golden ticket from her shop makes every take add more to the pick
const shareOf = (user) => (shop.holds(user, "goldenTicket") ? GOLDEN_TICKET_SHARE : pot.CREDIT_SHARE);

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
    creditShare: shareOf(user),
    pick: pot.pickAt(index),
    nextPick: pot.pickAt(index + 1),
    pickProgress: user.bonusAmount > 0 ? Math.min(1, (user.potCycleClaimed || 0) / user.bonusAmount) : 0,
    creditTtlMs: pot.CREDIT_TTL_MS,
    bonuses: pot.bonusesOf(user, now),
  };
};

router.get("/status", ...gate, (req, res) => {
  res.json(statusOf(req.user));
});

const TOUR_STEPS = ["pot", "case", "open", "drop", "game", "bet", "range", "play", "done"];
// where each status may be reached from; skipped and done are final, so a tour runs once. null is an account from before the tour
const TOUR_FROM = { active: ["offered", "active", null], skipped: ["offered", "active", null], done: ["active"] };

router.post("/tour", ...gate, async (req, res) => {
  const { status, step } = req.body || {};
  if (!TOUR_FROM[status]) return res.status(400).json({ message: "Unknown tour status" });
  if (step != null && !TOUR_STEPS.includes(step)) return res.status(400).json({ message: "Unknown tour step" });
  try {
    const now = new Date();
    const was = (req.user.onboarding && req.user.onboarding.status) || null;
    const set = { "onboarding.status": status };
    if (step) set["onboarding.step"] = step;
    if (status === "active" && (was === "offered" || was === null)) set["onboarding.startedAt"] = now;
    if (status !== "active") set["onboarding.endedAt"] = now;
    const result = await User.updateOne({ _id: req.user._id, "onboarding.status": { $in: TOUR_FROM[status] } }, { $set: set });
    if (!result.matchedCount) return res.status(409).json({ message: "The tour is not running", reason: "tour" });
    res.json({ onboarding: { status, step: step || (req.user.onboarding && req.user.onboarding.step) || null } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
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

    const credit = pot.creditOf(amount, shareOf(req.user));
    const pick = pot.pickAt(req.user.potPickIndex);
    const advanced = pot.advancePick(req.user.potPickIndex, req.user.potCycleClaimed, amount, req.user.bonusAmount);
    const nextBonus = new Date(now.getTime() + pot.CYCLE_MS);
    // bonuses nobody played in time go back to the mint with this take
    const expired = pot.expiredCredits(req.user, now);

    // the stored nextBonus is the version the take was priced against: a second request
    // that lands after the first sees a different one and pays nothing
    const updated = await runAtomic(async (session) => {
      const filter = { _id: req.user._id, nextBonus: req.user.nextBonus };
      const inc = { walletBalance: amount };
      const set = {
        nextBonus,
        bonusAmount: pot.fullAmount(req.user.level),
        potPickIndex: advanced.index,
        potCycleClaimed: advanced.cycleClaimed,
      };
      // burned amounts are pinned too, so a bet that spent one just before it expired is never burned twice
      for (const b of expired) {
        filter[`gameCredits.${b.game}`] = b.amount;
        set[`gameCredits.${b.game}`] = 0;
      }
      if (credit > 0) {
        // a top-up restarts that game's clock; on an expired bonus it starts over from this credit alone
        if (expired.some((b) => b.game === pick)) set[`gameCredits.${pick}`] = credit;
        else inc[`gameCredits.${pick}`] = credit;
        set[`gameCreditsExpireAt.${pick}`] = new Date(now.getTime() + pot.CREDIT_TTL_MS);
      }
      const u = await User.findOneAndUpdate(filter, { $inc: inc, $set: set }, { new: true, projection: WITHOUT_INVENTORY, session });
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
      for (const b of expired) {
        await recordTransaction(
          { userId: req.user._id, type: TX.GAME_CREDIT_EXPIRED, direction: "debit", amount: b.amount, balanceAfter: u.walletBalance, meta: { game: b.game } },
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

router.get("/missions", ...gate, async (req, res) => {
  try {
    res.json(await roadmap.viewFor(req.user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/missions/visit", ...gate, async (req, res) => {
  try {
    const r = await roadmap.visit(req.user, req.body && req.body.goal);
    res.status(r.code).json(r.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/missions/:key/claim", ...gate, async (req, res) => {
  try {
    const r = await roadmap.claim(req.user, String(req.params.key));
    res.status(r.code).json(r.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/shop", ...gate, async (req, res) => {
  try {
    res.json(await shop.viewFor(req.user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/shop/:key/buy", ...gate, async (req, res) => {
  try {
    const r = await shop.buy(req.user, String(req.params.key));
    res.status(r.code).json(r.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
