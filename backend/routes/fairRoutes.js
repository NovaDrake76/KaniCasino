const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const Round = require("../models/Round");
const BlackjackHand = require("../models/BlackjackHand");
const MinesGame = require("../models/MinesGame");
const { crashPointFromSeed } = require("../utils/crashMath");
const { coinResultFromSeed } = require("../utils/coinMath");
const { sha256 } = require("../utils/hashChain");

const cleanClientSeed = (raw) => {
  const s = (raw || "").toString().trim();
  if (!s || s.length > 256) return null;
  return s;
};

// current active seed (public fields only, never the secret serverSeed)
router.get("/seed", isAuthenticated, async (req, res) => {
  try {
    res.json(await seeds.getPublicSeedState(req.user._id));
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// set a new client seed for the active seed
router.post("/client-seed", isAuthenticated, async (req, res) => {
  try {
    const clientSeed = cleanClientSeed(req.body.clientSeed);
    if (!clientSeed) return res.status(400).json({ message: "Invalid client seed" });
    const seed = await seeds.setClientSeed(req.user._id, clientSeed);
    res.json({ clientSeed: seed.clientSeed, serverSeedHash: seed.serverSeedHash, nonce: seed.nonce });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// rotate: reveal the old serverSeed, commit a fresh one
router.post("/rotate", isAuthenticated, async (req, res) => {
  try {
    // revealing mid-hand would hand the player the dealer's hole card and every
    // future draw of the live blackjack hand
    if (await BlackjackHand.exists({ userId: req.user._id, status: "active" })) {
      return res.status(409).json({ message: "Finish your blackjack hand before rotating" });
    }
    // and mid-mines would reveal the committed mine layout
    if (await MinesGame.exists({ userId: req.user._id, status: "active" })) {
      return res.status(409).json({ message: "Finish your mines game before rotating" });
    }
    const newClientSeed = req.body.clientSeed ? cleanClientSeed(req.body.clientSeed) : undefined;
    const { revealed, current } = await seeds.rotate(req.user._id, newClientSeed);
    res.json({
      revealed: revealed
        ? {
            serverSeed: revealed.serverSeed,
            serverSeedHash: revealed.serverSeedHash,
            clientSeed: revealed.clientSeed,
            nonce: revealed.nonce,
          }
        : null,
      current: { serverSeedHash: current.serverSeedHash, clientSeed: current.clientSeed, nonce: current.nonce },
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// revealed seeds the user can fully verify
router.get("/seeds/revealed", isAuthenticated, async (req, res) => {
  try {
    res.json(await seeds.getRevealedSeeds(req.user._id));
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// public roll lookup (the "provably fair data" page). serverSeed appears only once
// the seed has been rotated/revealed.
router.get("/roll/:rollId", async (req, res) => {
  try {
    const view = await rolls.getRollForVerify(req.params.rollId);
    if (!view) return res.status(404).json({ message: "Roll not found" });
    res.json(view);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// look up the roll that produced an inventory item (by its uniqueId)
router.get("/roll-by-item/:uniqueId", async (req, res) => {
  try {
    const view = await rolls.getRollForItem(req.params.uniqueId);
    if (!view) return res.status(404).json({ message: "No roll found for this item" });
    res.json(view);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// server-side reproduction of a roll (only possible after reveal); case and plinko today
router.get("/roll/:rollId/verify", async (req, res) => {
  try {
    res.json(await rolls.verifyRoll(req.params.rollId));
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// verify a crash round. while it is still live only the commitment is public; once it
// settles the seed is revealed and anyone can reproduce the crash point and the chain link.
router.get("/crash/:roundId", async (req, res) => {
  try {
    const round = await Round.findById(req.params.roundId);
    if (!round || round.game !== "crash") return res.status(404).json({ message: "Round not found" });

    const revealed = round.status === "settled" || round.status === "voided";
    const view = {
      roundId: String(round._id),
      status: round.status,
      serverSeedHash: round.serverSeedHash,
      chainIndex: round.chainIndex,
      revealed,
    };
    if (!revealed) return res.json(view);

    const recomputed = crashPointFromSeed(round.serverSeed);
    res.json({
      ...view,
      serverSeed: round.serverSeed,
      crashPoint: round.outcome && round.outcome.crashPoint,
      recomputedCrashPoint: recomputed,
      commitmentValid: sha256(round.serverSeed) === round.serverSeedHash,
      outcomeValid: recomputed === (round.outcome && round.outcome.crashPoint),
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// verify a coin flip round. the result is only revealed once the round settles, and then
// anyone can reproduce it from the seed and check the chain link.
router.get("/coinflip/:roundId", async (req, res) => {
  try {
    const round = await Round.findById(req.params.roundId);
    if (!round || round.game !== "coinflip") return res.status(404).json({ message: "Round not found" });

    const revealed = round.status === "settled";
    const view = {
      roundId: String(round._id),
      status: round.status,
      serverSeedHash: round.serverSeedHash,
      chainIndex: round.chainIndex,
      revealed,
    };
    if (!revealed) return res.json(view);

    const recomputed = coinResultFromSeed(round.serverSeed);
    res.json({
      ...view,
      serverSeed: round.serverSeed,
      result: round.outcome && round.outcome.result,
      recomputedResult: recomputed,
      commitmentValid: sha256(round.serverSeed) === round.serverSeedHash,
      outcomeValid: recomputed === (round.outcome && round.outcome.result),
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
