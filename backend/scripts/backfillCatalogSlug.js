require("dotenv").config();
const mongoose = require("mongoose");
const Case = require("../models/Case");
const Item = require("../models/Item");
const { baseSlugFor, qualifiedSlug, RESERVED } = require("../utils/slugs");

// gives every case and every item its shelf url. a name that repeats belongs to more than
// one case, so the case is what tells them apart: "saki" and "saki-kivotos-case" rather
// than "saki" and "saki-2", which would say nothing about which Saki it is.
//
// usage:
//   node scripts/backfillCatalogSlug.js --dry
//   node scripts/backfillCatalogSlug.js
async function backfill({ dry = false } = {}) {
  const cases = await Case.find({}, { title: 1, slug: 1 }).sort({ _id: 1 }).lean();
  const items = await Item.find({}, { name: 1, case: 1, slug: 1 }).sort({ _id: 1 }).lean();
  const caseTitle = new Map(cases.map((c) => [String(c._id), c.title]));

  const plan = (rows, nameOf, qualifierOf) => {
    const taken = new Set(rows.filter((r) => r.slug).map((r) => r.slug));
    const out = [];
    let skipped = 0;
    let none = 0;
    for (const row of rows) {
      if (row.slug) {
        skipped++;
        continue;
      }
      const base = baseSlugFor(nameOf(row));
      if (!base) {
        none++;
        continue;
      }
      let slug = base;
      if (taken.has(slug) || RESERVED.has(slug)) {
        const qualifier = qualifierOf ? qualifierOf(row) : null;
        const qualified = qualifiedSlug(nameOf(row), qualifier);
        slug = qualified && qualified !== base && !taken.has(qualified) ? qualified : null;
        if (!slug) {
          for (let n = 2; ; n++) {
            const candidate = `${base}-${n}`;
            if (!taken.has(candidate) && !RESERVED.has(candidate)) {
              slug = candidate;
              break;
            }
          }
        }
      }
      taken.add(slug);
      out.push({ _id: row._id, name: nameOf(row), slug, base });
    }
    return { out, skipped, none };
  };

  const casePlan = plan(cases, (c) => c.title);
  const itemPlan = plan(items, (i) => i.name, (i) => caseTitle.get(String(i.case)));

  for (const [label, rows, p] of [["cases", cases, casePlan], ["items", items, itemPlan]]) {
    console.log(`${label}: ${rows.length} total | ${p.skipped} already had one | ${p.none} cannot have one | ${p.out.length} to write`);
    const moved = p.out.filter((r) => r.slug !== r.base);
    console.log(`   ${moved.length} had to be qualified:`);
    moved.slice(0, 30).forEach((r) => console.log(`      ${r.name} -> ${r.slug}`));
  }

  if (dry) return { casePlan, itemPlan };

  for (const [Model, p] of [[Case, casePlan], [Item, itemPlan]]) {
    for (let i = 0; i < p.out.length; i += 500) {
      const chunk = p.out.slice(i, i + 500);
      await Model.bulkWrite(
        chunk.map((r) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { slug: r.slug } } } }))
      );
      console.log(`${Model.modelName}: wrote ${Math.min(i + 500, p.out.length)}/${p.out.length}`);
    }
  }
  return { casePlan, itemPlan };
}

if (require.main === module) {
  const dry = process.argv.includes("--dry");
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => backfill({ dry }))
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = backfill;
