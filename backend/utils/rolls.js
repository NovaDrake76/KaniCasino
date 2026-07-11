const crypto = require("crypto");
const Roll = require("../models/Roll");
const Seed = require("../models/Seed");
const CaseConfig = require("../models/CaseConfig");
const { roll: computeRoll, pickFromRanges } = require("./provablyFair");

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

module.exports = { generateRollId, recordRoll, getRollForVerify, getRollForItem, verifyCaseRoll };
