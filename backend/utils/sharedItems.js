const { baseValuesForCase } = require("./itemValue");

// one item can drop from several cases (the anime year cases hold a character every year their show airs), keeping
// one rarity and one value wherever it drops; `item.case` stays the first case it came from

// the key a spec item is shared under: the same name in the same category is the same item
const sharedKey = (category, name) => `${String(category || "").trim()}::${String(name).trim()}`;

// which spec items reuse an item (earlier in the spec, or in `existing`: key -> { _id, rarity, baseValue }) and what
// would break: a shared item has one rarity and one baseValue, so every case holding it must agree on both
function planSharedItems(cases, existing = new Map()) {
  const problems = [];
  const firstSeen = new Map();
  const planned = cases.map((c) => {
    const rows = c.items.map((item) => {
      const key = sharedKey(c.category, item.name);
      const rarity = String(item.rarity);
      const known = existing.get(key);
      if (known && String(known.rarity) !== rarity) {
        problems.push(`${c.title}: ${item.name} is rarity ${rarity} here but ${known.rarity} in the catalog`);
      }
      const earlier = firstSeen.get(key);
      if (earlier && earlier.rarity !== rarity) {
        problems.push(`${c.title}: ${item.name} is rarity ${rarity} here but ${earlier.rarity} in ${earlier.title}`);
      }
      if (!earlier) firstSeen.set(key, { rarity, title: c.title });
      return { key, name: item.name, rarity, reuse: known ? known._id : null, sharedInSpec: !!earlier };
    });
    return { ...c, rows };
  });

  // the value a case would give each of its items, compared across every case and the catalog
  const valueOf = new Map();
  for (const c of planned) {
    const values = baseValuesForCase({ price: c.price, items: c.rows.map((r, i) => ({ _id: String(i), rarity: r.rarity })) });
    c.rows.forEach((r, i) => {
      const v = values[String(i)];
      const seen = valueOf.get(r.key);
      if (seen && seen.value !== v) problems.push(`${r.name} would be worth ${v} in ${c.title} but ${seen.value} in ${seen.title}`);
      if (!seen) valueOf.set(r.key, { value: v, title: c.title });
      const known = existing.get(r.key);
      if (known && known.baseValue && known.baseValue !== v) {
        problems.push(`${r.name} would be worth ${v} in ${c.title} but is worth ${known.baseValue} today`);
      }
    });
  }
  return { cases: planned, problems: [...new Set(problems)] };
}

// every case each of these items drops from, from the cases' own item lists
async function casesContaining(itemIds) {
  const Case = require("../models/Case");
  const ids = [...new Set((itemIds || []).map(String))];
  const byItem = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return byItem;
  const cases = await Case.find({ items: { $in: ids } }, { items: 1 }).lean();
  for (const c of cases) {
    for (const id of c.items || []) {
      const key = String(id);
      if (byItem.has(key)) byItem.get(key).push(String(c._id));
    }
  }
  return byItem;
}

// every case holding an item: the ones that list it, and its own first case
async function casesHolding(item) {
  const listed = (await casesContaining([item._id])).get(String(item._id)) || [];
  return [...new Set([...listed, ...(item.case ? [String(item.case)] : [])])];
}

// an item's rarity or its removal changes every case it drops from, not only its first
async function recomputeCasesHolding(item, { pull = false } = {}) {
  const Case = require("../models/Case");
  const { recomputeCaseValues } = require("./itemValue");
  const holding = await casesHolding(item);
  if (pull && holding.length) await Case.updateMany({ _id: { $in: holding } }, { $pull: { items: item._id } });
  for (const caseId of holding) await recomputeCaseValues(caseId);
  return holding;
}

module.exports = { sharedKey, planSharedItems, casesContaining, casesHolding, recomputeCasesHolding };
