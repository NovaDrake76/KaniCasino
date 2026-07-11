const { Rarities } = require("./caseOpening");

// tunable economy knobs
const RARITY_MULTIPLIER = { "1": 1, "2": 4, "3": 12, "4": 40, "5": 100 };
const RTP = 0.9; // expected item value per open = case price * RTP (10% open edge)
const SELL_RATE = 0.75; // instant sell-to-house = base value * SELL_RATE

const chanceFor = (rarityId) => {
  const r = Rarities.find((x) => x.id === String(rarityId));
  return r ? r.chance : 0;
};

// base value of an item is derived from its case: rarer items are worth more,
// and the case's expected payout is price * RTP. odds are renormalized over the
// rarities actually present in the case. returns { itemId(string): baseValue }.
function baseValuesForCase(caseDoc) {
  const items = (((caseDoc && caseDoc.items) || []).filter(Boolean));
  if (!items.length || !caseDoc.price) return {};

  const present = [...new Set(items.map((i) => String(i.rarity)))].filter(
    (r) => RARITY_MULTIPLIER[r] != null
  );
  const totalChance = present.reduce((s, r) => s + chanceFor(r), 0);
  if (totalChance <= 0) return {};

  const denom = present.reduce(
    (s, r) => s + (chanceFor(r) / totalChance) * RARITY_MULTIPLIER[r],
    0
  );
  if (denom <= 0) return {};

  const A = (caseDoc.price * RTP) / denom;
  const values = {};
  for (const item of items) {
    const m = RARITY_MULTIPLIER[String(item.rarity)] || 0;
    values[String(item._id)] = Math.round(A * m);
  }
  return values;
}

const sellValue = (baseValue) => Math.floor((baseValue || 0) * SELL_RATE);

// recompute and persist baseValue for every item in a case, and (re)materialize the
// provably-fair range table, bumping the case's config version + archiving it when
// the mapping actually changes so past rolls stay verifiable against a pinned version.
async function recomputeCaseValues(caseId) {
  const Case = require("../models/Case");
  const Item = require("../models/Item");
  const CaseConfig = require("../models/CaseConfig");
  const { buildRangeTable } = require("./caseRanges");

  const caseDoc = await Case.findById(caseId).populate("items");
  if (!caseDoc) return;

  const values = baseValuesForCase(caseDoc);
  const ops = Object.entries(values).map(([id, v]) => ({
    updateOne: { filter: { _id: id }, update: { $set: { baseValue: v } } },
  }));
  if (ops.length) await Item.bulkWrite(ops);

  const { total, rangeTable, configHash, rarityTableVersion } = buildRangeTable(caseDoc);
  if (configHash && configHash !== caseDoc.configHash) {
    const bumped = await Case.findByIdAndUpdate(
      caseId,
      {
        $set: { rollTotal: total, rangeTable, configHash, rarityTableVersion },
        $inc: { configVersion: 1 },
      },
      { new: true }
    );
    await CaseConfig.updateOne(
      { caseId, configVersion: bumped.configVersion },
      { $set: { configHash, rollTotal: total, rarityTableVersion, rangeTable } },
      { upsert: true }
    );
  }
}

module.exports = {
  RARITY_MULTIPLIER,
  RTP,
  SELL_RATE,
  baseValuesForCase,
  sellValue,
  recomputeCaseValues,
};
