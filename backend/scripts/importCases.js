// bulk-create cases and their items from a json spec, then recompute odds/values. the
// manual admin flow is one item at a time; this seeds a whole set in one pass.
//
// usage:  node scripts/importCases.js <spec.json> [--commit]
//   dry run by default (prints what it would do); pass --commit to write.
//   idempotent: a case whose title already exists is skipped, so re-running is safe.
//
// spec shape: { "Millennium": { price: 45, cover: "<url>", category: "Blue Archive",
//   items: [ { name, rarity: "1".."5", image: "<url>", character? }, ... ] }, ... }
//   character names the person behind an alt outfit, so both count on one fan board.
//   collectible: false keeps a case off its category's collection badge.
//   the title defaults to "<key> Case"; set def.title to override it.
//   an item name repeated in the same category is one item that drops from every case listing it, and an item of
//   that category already in the catalog is reused; the import refuses when the cases would disagree on its value.
const mongoose = require("mongoose");
require("dotenv").config();
const fs = require("fs");
const Case = require("../models/Case");
const Item = require("../models/Item");
const { recomputeCaseValues } = require("../utils/itemValue");
const { sharedKey, planSharedItems } = require("../utils/sharedItems");

const titleFor = (name) => `${name} Case`;

// the catalog's items for these categories, by shared key
async function existingItems(categories) {
  const cases = await Case.find({ category: { $in: categories } }, { category: 1, items: 1 }).lean();
  const categoryOf = new Map();
  for (const c of cases) for (const id of c.items || []) categoryOf.set(String(id), c.category);
  const items = await Item.find({ _id: { $in: [...categoryOf.keys()] } }, { name: 1, rarity: 1, baseValue: 1 }).lean();
  return new Map(items.map((i) => [sharedKey(categoryOf.get(String(i._id)), i.name), i]));
}

async function main() {
  const specPath = process.argv[2];
  const commit = process.argv.includes("--commit");
  if (!specPath) {
    console.error("usage: node scripts/importCases.js <spec.json> [--commit]");
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (run where backend/.env is available)");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(commit ? "== COMMIT: writing to the database ==\n" : "== DRY RUN (pass --commit to write) ==\n");

  const todo = [];
  for (const [name, def] of Object.entries(spec)) {
    const title = def.title || titleFor(name);
    if (await Case.findOne({ title })) {
      console.log(`skip "${title}" — already exists`);
      continue;
    }
    todo.push({ ...def, title, category: def.category || "" });
  }

  const existing = await existingItems([...new Set(todo.map((d) => d.category))]);
  const { cases: plan, problems } = planSharedItems(todo, existing);
  for (const c of plan) {
    const byTier = c.rows.reduce((m, r) => ((m[r.rarity] = (m[r.rarity] || 0) + 1), m), {});
    const reused = c.rows.filter((r) => r.reuse || r.sharedInSpec).length;
    console.log(`"${c.title}" — ${c.rows.length} items (${reused} shared with another case), ${c.price} KP, tiers ${JSON.stringify(byTier)}`);
  }
  if (problems.length) {
    console.error(`\n${problems.length} problem(s), nothing written:\n  ${problems.join("\n  ")}`);
    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }

  let created = 0;
  const made = new Map();
  for (const c of commit ? plan : []) {
    const doc = await Case.create({
      title: c.title,
      image: c.cover,
      price: c.price,
      category: c.category,
      collectible: c.collectible !== false,
      items: [],
    });
    const fresh = c.items.filter((item, i) => !c.rows[i].reuse && !made.has(c.rows[i].key));
    const inserted = await Item.insertMany(
      fresh.map((i) => ({
        name: i.name,
        character: i.character && i.character !== i.name ? i.character : undefined,
        image: i.image,
        rarity: String(i.rarity),
        case: doc._id,
      }))
    );
    for (const item of inserted) made.set(sharedKey(c.category, item.name), item._id);
    const ids = c.rows.map((r) => r.reuse || made.get(r.key));
    await Case.updateOne({ _id: doc._id }, { $set: { items: ids } });
    await recomputeCaseValues(doc._id); // baseValues + provably-fair range table
    console.log(`  -> created "${c.title}" ${doc._id}: ${inserted.length} new items, ${ids.length - inserted.length} shared, values recomputed`);
    created += 1;
  }

  await mongoose.disconnect();
  console.log(`\n${commit ? `done: ${created} case(s) created.` : "dry run complete."}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
