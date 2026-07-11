const crypto = require("crypto");
const { Rarities } = require("./caseOpening");
const { TOTAL } = require("./provablyFair");

// bump if the Rarities weight table ever changes, so old rolls stay attributable
// to the weights they were rolled under.
const RARITY_TABLE_VERSION = 1;

const chanceFor = (rarityId) => {
  const r = Rarities.find((x) => x.id === String(rarityId));
  return r ? r.chance : 0;
};

// deterministic order so the range assignment is reproducible: rarity desc, then _id.
const orderItems = (items) =>
  [...items].sort((a, b) => {
    const dr = Number(b.rarity) - Number(a.rarity);
    if (dr !== 0) return dr;
    return String(a._id).localeCompare(String(b._id));
  });

// partition [1, total] into one contiguous range per item, sized to its probability.
// mirrors baseValuesForCase: prob(item) = (chance_r / totalChance) / itemsInRarity_r,
// renormalized over the rarities the case actually contains. ranges are contiguous
// (no gaps/overlaps), each at least 1 wide, and always sum to `total`.
function buildRangeTable(caseDoc, total = TOTAL) {
  const items = (((caseDoc && caseDoc.items) || []).filter(Boolean));
  if (!items.length) {
    return { total, rarityTableVersion: RARITY_TABLE_VERSION, rangeTable: [], configHash: null };
  }

  const ordered = orderItems(items);
  const present = [...new Set(ordered.map((i) => String(i.rarity)))].filter((r) => chanceFor(r) > 0);
  const totalChance = present.reduce((s, r) => s + chanceFor(r), 0);
  const countInRarity = {};
  for (const it of ordered) {
    const r = String(it.rarity);
    countInRarity[r] = (countInRarity[r] || 0) + 1;
  }

  const rangeTable = [];
  let cumProb = 0;
  let prevEnd = 0;
  for (let i = 0; i < ordered.length; i++) {
    const it = ordered[i];
    const r = String(it.rarity);
    const c = chanceFor(r);
    const prob = c && totalChance ? c / totalChance / countInRarity[r] : 0;
    cumProb += prob;

    const start = prevEnd + 1;
    // last item absorbs the rounding remainder so the ranges cover exactly [1, total]
    let end = i === ordered.length - 1 ? total : Math.round(cumProb * total);
    if (end < start) end = start; // min width 1 (never an undroppable item)
    if (end > total) end = total;

    rangeTable.push({ itemId: String(it._id), rarity: r, start, end });
    prevEnd = end;
  }

  const configHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        v: RARITY_TABLE_VERSION,
        total,
        ranges: rangeTable.map((x) => [x.itemId, x.start, x.end]),
      })
    )
    .digest("hex");

  return { total, rarityTableVersion: RARITY_TABLE_VERSION, rangeTable, configHash };
}

module.exports = { RARITY_TABLE_VERSION, buildRangeTable };
