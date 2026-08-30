const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");

const User = require("../models/User");
const Case = require("../models/Case");
const gift = require("../utils/dailyGift");
const { roll, TOTAL } = require("../utils/provablyFair");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const { WITHOUT_INVENTORY } = require("../utils/economy");

const living = (user, now = new Date()) =>
  (user.freeOpens || []).filter((g) => g.remaining > 0 && new Date(g.expiresAt) > now);

async function casesByCategory() {
  const all = await Case.find({}).select("title image price category").lean();
  return all.reduce((acc, c) => {
    if (!c.category) return acc;
    (acc[c.category] = acc[c.category] || []).push(c);
    return acc;
  }, {});
}

// the categories a player can choose between, each with the table it would spin and a
// cover to show. the table is public on purpose: the odds are the pitch.
async function state(userId) {
  const user = await User.findById(userId).select("giftStreak giftNextAt freeOpens level");
  if (!user) return null;

  const now = new Date();
  const grouped = await casesByCategory();
  const streak = user.giftStreak || 0;
  const byId = new Map(
    Object.values(grouped)
      .flat()
      .map((c) => [String(c._id), c])
  );

  const categories = Object.entries(grouped)
    .map(([category, cases]) => {
      const table = gift.tableFor(cases);
      if (!table.length) return null;
      const weights = gift.weightsFor(table, streak);
      const total = weights.reduce((a, b) => a + b, 0);
      return {
        category,
        cover: table[table.length - 1].image,
        eligible: gift.eligible(cases).length,
        expectedValue: Math.round(gift.expectedValue(table, streak)),
        slots: table.map((s, i) => ({
          caseId: s.caseId,
          title: s.title,
          image: s.image,
          price: s.price,
          opens: s.opens,
          value: s.value,
          chance: Number(((weights[i] / total) * 100).toFixed(2)),
        })),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.category.localeCompare(b.category));

  const wheel = gift.topSlotFor(user.level || 0);

  // the streak's whole effect stated as one number: how much likelier it makes the rarest
  // prize, which is exactly the weight multiplier it puts on the top slot of either wheel
  const rareBoost = (days) => Number((1 + gift.streakTilt(days) * 2).toFixed(2));
  const streakMax = Math.ceil(gift.MAX_STREAK_TILT / gift.STREAK_STEP);

  return {
    level: user.level || 0,
    streak,
    streakTilt: gift.streakTilt(streak),
    // the locked rungs stay visible: they are the reason to keep levelling
    topSlot: wheel.map((t) => ({
      multiplier: t.multiplier,
      minLevel: t.minLevel,
      locked: t.locked,
      chance: (() => {
        const w = gift.topSlotWeights(wheel, streak);
        const total = w.reduce((a, b) => a + b, 0);
        const i = wheel.indexOf(t);
        return total ? Number(((w[i] / total) * 100).toFixed(2)) : 0;
      })(),
    })),
    topSlotAverage: Number(gift.topSlotAverage(user.level || 0, streak).toFixed(2)),
    maxStreakTilt: gift.MAX_STREAK_TILT,
    streakMax,
    rareBoost: rareBoost(streak),
    atBestStreak: {
      rareBoost: rareBoost(streakMax),
      topSlotAverage: Number(gift.topSlotAverage(user.level || 0, streakMax).toFixed(2)),
    },
    canSpin: !user.giftNextAt || new Date(user.giftNextAt) <= now,
    nextAt: user.giftNextAt || null,
    categories,
    grants: living(user, now)
      .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))
      .map((g) => ({
        grantId: g.grantId,
        caseId: String(g.caseId),
        title: byId.get(String(g.caseId))?.title || "",
        image: byId.get(String(g.caseId))?.image || "",
        remaining: g.remaining,
        expiresAt: g.expiresAt,
      })),
  };
}

router.get("/", isAuthenticated, async (req, res) => {
  const s = await state(req.user._id);
  if (!s) return res.status(404).json({ message: "User not found" });
  res.json(s);
});

// only whether a spin is waiting. the navbar asks on every page, and it has no business
// building every category's prize table to light up a badge
router.get("/status", isAuthenticated, async (req, res) => {
  const user = await User.findById(req.user._id).select("giftNextAt giftLastAt giftStreak");
  if (!user) return res.status(404).json({ message: "User not found" });
  const now = new Date();
  // the streak this spin would put them on, not the one they are on: the prompt has to say
  // what is at stake if they take it, and what they lose by leaving it
  const streak = gift.nextStreak(user.giftStreak, user.giftLastAt, now);
  res.json({
    canSpin: !user.giftNextAt || new Date(user.giftNextAt) <= now,
    nextAt: user.giftNextAt || null,
    streak: user.giftStreak || 0,
    nextStreak: streak,
    keepsStreak: streak > 1,
  });
});

// just the unspent grants, so the case page can show what is free there without paying
// for the whole prize-table computation
router.get("/grants", isAuthenticated, async (req, res) => {
  const user = await User.findById(req.user._id).select("freeOpens");
  if (!user) return res.status(404).json({ message: "User not found" });
  const caseId = req.query.caseId ? String(req.query.caseId) : null;
  const mine = living(user)
    .filter((g) => !caseId || String(g.caseId) === caseId)
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));

  const cases = await Case.find({ _id: { $in: mine.map((g) => g.caseId) } })
    .select("title image")
    .lean();
  const byId = new Map(cases.map((c) => [String(c._id), c]));

  res.json(
    mine.map((g) => ({
      grantId: g.grantId,
      caseId: String(g.caseId),
      title: byId.get(String(g.caseId))?.title || "",
      image: byId.get(String(g.caseId))?.image || "",
      remaining: g.remaining,
      expiresAt: g.expiresAt,
    }))
  );
});

router.post("/spin", isAuthenticated, async (req, res) => {
  try {
    const category = String(req.body?.category || "");
    const user = await User.findById(req.user._id).select("giftStreak giftNextAt giftLastAt level freeOpens");
    if (!user) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    if (user.giftNextAt && new Date(user.giftNextAt) > now) {
      return res.status(400).json({ message: "You already opened today's gift" });
    }

    const grouped = await casesByCategory();
    const cases = grouped[category];
    if (!cases) return res.status(400).json({ message: "Unknown category" });

    const table = gift.tableFor(cases);
    if (!table.length) return res.status(400).json({ message: "Nothing to give in that category" });

    const streak = gift.nextStreak(user.giftStreak, user.giftLastAt, now);

    // two draws, one per stage, so each is independently verifiable on the fair page
    const reserved = await seeds.reserveNonces(user._id, 2);
    const reelRoll = roll(reserved.serverSeed, reserved.clientSeed, reserved.startNonce);
    const topRoll = roll(reserved.serverSeed, reserved.clientSeed, reserved.startNonce + 1);

    const won = gift.pickSlot(table, reelRoll, TOTAL, streak);
    const wheel = gift.topSlotFor(user.level || 0);

  // the streak's whole effect stated as one number: how much likelier it makes the rarest
  // prize, which is exactly the weight multiplier it puts on the top slot of either wheel
  const rareBoost = (days) => Number((1 + gift.streakTilt(days) * 2).toFixed(2));
  const streakMax = Math.ceil(gift.MAX_STREAK_TILT / gift.STREAK_STEP);
    const top = gift.pickTopSlot(wheel, topRoll, TOTAL, streak);
    const opens = won.opens * top.multiplier;

    const expiresAt = new Date(now.getTime() + gift.GRANT_TTL_MS);

    // winning the same case twice tops the grant up instead of opening a rival one, so the
    // case page has a single number to show and to spend
    const existing = living(user, now).find((g) => String(g.caseId) === String(won.caseId));
    const update = {
      $set: {
        giftNextAt: gift.nextResetAt(now),
        giftLastAt: now,
        giftStreak: streak,
      },
    };
    const options = { new: true, projection: WITHOUT_INVENTORY };
    if (existing) {
      update.$inc = { "freeOpens.$[g].remaining": opens };
      update.$set["freeOpens.$[g].expiresAt"] = expiresAt;
      options.arrayFilters = [{ "g.grantId": existing.grantId }];
    } else {
      update.$push = { freeOpens: { caseId: won.caseId, remaining: opens, wonAt: now, expiresAt } };
    }

    // the cooldown, the streak and the grant land together, and the cooldown is keyed on
    // giftNextAt so a crash between them cannot hand out a second spin
    const updated = await User.findOneAndUpdate(
      { _id: user._id, $or: [{ giftNextAt: { $exists: false } }, { giftNextAt: { $lte: now } }] },
      update,
      options
    );
    if (!updated) return res.status(400).json({ message: "You already opened today's gift" });

    const granted = existing
      ? updated.freeOpens.find((g) => g.grantId === existing.grantId)
      : updated.freeOpens[updated.freeOpens.length - 1];

    for (const [nonce, value] of [
      [reserved.startNonce, reelRoll],
      [reserved.startNonce + 1, topRoll],
    ]) {
      await rolls.recordRoll({
        game: "gift",
        userId: user._id,
        seedId: reserved.seedId,
        clientSeed: reserved.clientSeed,
        serverSeedHash: reserved.serverSeedHash,
        nonce,
        roll: value,
        total: TOTAL,
        algoVersion: gift.GIFT_ALGO_VERSION,
      });
    }

    res.json({
      category,
      won: {
        caseId: won.caseId,
        title: won.title,
        image: won.image,
        opens: won.opens,
        value: won.value,
      },
      topSlot: { multiplier: top.multiplier, hit: top.multiplier > 1 },
      opens,
      grantId: granted.grantId,
      grantRemaining: granted.remaining,
      expiresAt: granted.expiresAt,
      streak,
      state: await state(user._id),
    });
  } catch (err) {
    console.error("gift spin:", err.message);
    res.status(500).json({ message: "Could not open the gift" });
  }
});

module.exports = router;
