const crypto = require("crypto");
const Roll = require("../models/Roll");
const Seed = require("../models/Seed");
const CaseConfig = require("../models/CaseConfig");
const { roll: computeRoll, pickFromRanges, hashServerSeed } = require("./provablyFair");
const { PAYOUTS: PLINKO_PAYOUTS, PLINKO_ALGO_VERSION, derivePath, binFromPath } = require("./plinkoMath");
const { BLACKJACK_ALGO_VERSION, replayHand } = require("./blackjackMath");

function generateRollId() {
  return "R" + crypto.randomInt(100000000, 1000000000).toString(); // "R" + 9 digits
}

async function recordRoll(data) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await Roll.create({ rollId: generateRollId(), ...data });
    } catch (e) {
      if (e.code === 11000 && attempt < 4) continue; // rollId collision -> retry
      throw e;
    }
  }
}

// public view of a roll for the verify page. the serverSeed is included ONLY once
// its seed has been rotated (revealed); otherwise only the commitment (hash) shows.
async function getRollForVerify(rollId) {
  const r = await Roll.findOne({ rollId }).lean();
  if (!r) return null;

  const seed = await Seed.findById(r.seedId).lean();
  const revealed = seed ? !seed.active : false;

  const base = {
    rollId: r.rollId,
    game: r.game,
    clientSeed: r.clientSeed,
    serverSeedHash: r.serverSeedHash,
    serverSeed: revealed && seed ? seed.serverSeed : null,
    nonce: r.nonce,
    cursor: r.cursor,
    roll: r.roll,
    total: r.total,
    createdAt: r.createdAt,
  };

  if (r.game === "case") {
    const config = await CaseConfig.findOne({
      caseId: r.caseId,
      configVersion: r.caseConfigVersion,
    }).lean();
    return {
      ...base,
      caseId: r.caseId,
      itemId: r.itemId,
      caseConfigVersion: r.caseConfigVersion,
      caseConfigHash: r.caseConfigHash,
      rangeTable: config ? config.rangeTable : null,
    };
  }
  return { ...base, outcome: r.outcome };
}

// find the roll that produced a given inventory item (case opens and upgrades store
// the uniqueId of the item they created). returns the verify view, or null.
async function getRollForItem(uniqueId) {
  if (!uniqueId) return null;
  const r = await Roll.findOne({ uniqueId }).select("rollId").lean();
  return r ? getRollForVerify(r.rollId) : null;
}

// recompute a case roll from its public inputs; only possible once revealed. this is
// the reference verifier: the same steps any third party would run.
async function verifyCaseRoll(rollId) {
  const v = await getRollForVerify(rollId);
  if (!v || v.game !== "case") return { ok: false, reason: "not a case roll" };
  if (!v.serverSeed) return { ok: false, reason: "server seed not revealed yet" };
  if (!v.rangeTable) return { ok: false, reason: "case config unavailable" };

  const recomputedRoll = computeRoll(v.serverSeed, v.clientSeed, v.nonce, {
    total: v.total,
    cursor: v.cursor,
  });
  const picked = pickFromRanges(recomputedRoll, v.rangeTable);
  const ok =
    recomputedRoll === v.roll && !!picked && String(picked.itemId) === String(v.itemId);

  return {
    ok,
    recomputedRoll,
    expectedRoll: v.roll,
    expectedItemId: String(v.itemId),
    pickedItemId: picked ? String(picked.itemId) : null,
  };
}

// recompute a plinko roll's path and payout from its public inputs; the same steps
// any third party would run once the seed is revealed
async function verifyPlinkoRoll(rollId) {
  const v = await getRollForVerify(rollId);
  if (!v || v.game !== "plinko") return { ok: false, reason: "not a plinko roll" };
  if (!v.serverSeed) return { ok: false, reason: "server seed not revealed yet" };

  const outcome = v.outcome || {};
  // rolls from an older table or row count cannot verify against the current constants
  if (outcome.algoVersion !== PLINKO_ALGO_VERSION) {
    return { ok: false, reason: "algorithm version superseded" };
  }
  const table = Object.prototype.hasOwnProperty.call(PLINKO_PAYOUTS, outcome.risk)
    ? PLINKO_PAYOUTS[outcome.risk]
    : null;
  if (!table) return { ok: false, reason: "unknown risk level" };

  const commitmentValid = hashServerSeed(v.serverSeed) === v.serverSeedHash;
  const recomputedRoll = computeRoll(v.serverSeed, v.clientSeed, v.nonce, {
    total: v.total,
    cursor: v.cursor,
  });
  const path = derivePath(v.serverSeed, v.clientSeed, v.nonce);
  const bin = binFromPath(path);
  const multiplier = table[bin] / 100;
  const ok =
    commitmentValid &&
    recomputedRoll === v.roll &&
    path === outcome.path &&
    bin === outcome.bin &&
    multiplier === outcome.multiplier;

  return {
    ok,
    commitmentValid,
    recomputedRoll,
    expectedRoll: v.roll,
    recomputedPath: path,
    recomputedBin: bin,
    recomputedMultiplier: multiplier,
    expectedPath: outcome.path,
    expectedBin: outcome.bin,
    expectedMultiplier: outcome.multiplier,
  };
}

// replay a blackjack hand from its seed material and recorded action log; the
// verifier runs the same replayHand the game's recovery path uses, so the two
// can never disagree about what the cards were
async function verifyBlackjackRoll(rollId) {
  const v = await getRollForVerify(rollId);
  if (!v || v.game !== "blackjack") return { ok: false, reason: "not a blackjack roll" };
  if (!v.serverSeed) return { ok: false, reason: "server seed not revealed yet" };

  const outcome = v.outcome || {};
  if (outcome.algoVersion !== BLACKJACK_ALGO_VERSION) {
    return { ok: false, reason: "algorithm version superseded" };
  }

  const commitmentValid = hashServerSeed(v.serverSeed) === v.serverSeedHash;
  const replayed = replayHand({
    serverSeed: v.serverSeed,
    clientSeed: v.clientSeed,
    nonce: v.nonce,
    betAmount: outcome.betAmount,
    actions: outcome.actions || [],
  });
  const expectedHand = (outcome.playerHands && outcome.playerHands[0]) || {};
  const replayedHand = replayed.hands[0];
  const sameCards = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ok =
    commitmentValid &&
    sameCards(replayedHand.cards, expectedHand.cards) &&
    sameCards(replayed.dealerCards, outcome.dealerCards) &&
    replayed.dealerTotal === outcome.dealerTotal &&
    replayed.perHand[0].outcome === expectedHand.outcome &&
    replayed.totalPayout === outcome.totalPayout;

  return {
    ok,
    commitmentValid,
    recomputedPlayerCards: replayedHand.cards,
    recomputedDealerCards: replayed.dealerCards,
    recomputedDealerTotal: replayed.dealerTotal,
    recomputedOutcome: replayed.perHand[0].outcome,
    recomputedPayout: replayed.totalPayout,
    expectedPlayerCards: expectedHand.cards,
    expectedDealerCards: outcome.dealerCards,
    expectedDealerTotal: outcome.dealerTotal,
    expectedOutcome: expectedHand.outcome,
    expectedPayout: outcome.totalPayout,
  };
}

// route a verify request to the game's reference verifier
async function verifyRoll(rollId) {
  const r = await Roll.findOne({ rollId }).select("game").lean();
  if (!r) return { ok: false, reason: "roll not found" };
  if (r.game === "case") return verifyCaseRoll(rollId);
  if (r.game === "plinko") return verifyPlinkoRoll(rollId);
  if (r.game === "blackjack") return verifyBlackjackRoll(rollId);
  return { ok: false, reason: "no server-side verifier for this game" };
}

module.exports = {
  generateRollId,
  recordRoll,
  getRollForVerify,
  getRollForItem,
  verifyCaseRoll,
  verifyPlinkoRoll,
  verifyBlackjackRoll,
  verifyRoll,
};
