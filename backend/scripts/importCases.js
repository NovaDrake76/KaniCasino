// bulk-create cases and their items from a json spec, then recompute odds/values. the
// manual admin flow is one item at a time; this seeds a whole set in one pass.
//
// usage:  node scripts/importCases.js <spec.json> [--commit]
//   dry run by default (prints what it would do); pass --commit to write.
//   idempotent: a case whose title already exists is skipped, so re-running is safe.
//
// spec shape: { "Millennium": { price: 45, cover: "<url>", category: "Blue Archive",
//   items: [ { name, rarity: "1".."5", image: "<url>" }, ... ] }, ... }
const mongoose = require("mongoose");
require("dotenv").config();
const fs = require("fs");
const Case = require("../models/Case");
const Item = require("../models/Item");
const { recomputeCaseValues } = require("../utils/itemValue");

const titleFor = (name) => `${name} Case`;

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

  let created = 0;
  for (const [name, def] of Object.entries(spec)) {
    const title = titleFor(name);
    if (await Case.findOne({ title })) {
      console.log(`skip "${title}" — already exists`);
      continue;
    }
    const byTier = def.items.reduce((m, i) => ((m[i.rarity] = (m[i.rarity] || 0) + 1), m), {});
    console.log(`"${title}" — ${def.items.length} items, ${def.price} KP, tiers ${JSON.stringify(byTier)}`);
    if (!commit) continue;

    const c = await Case.create({
      title,
      image: def.cover,
      price: def.price,
      category: def.category || "",
      items: [],
    });
    const items = await Item.insertMany(
      def.items.map((i) => ({ name: i.name, image: i.image, rarity: String(i.rarity), case: c._id }))
    );
    await Case.updateOne({ _id: c._id }, { $set: { items: items.map((i) => i._id) } });
    await recomputeCaseValues(c._id); // baseValues + provably-fair range table
    console.log(`  -> created ${c._id} with ${items.length} items, values recomputed`);
    created += 1;
  }

  await mongoose.disconnect();
  console.log(`\n${commit ? `done: ${created} case(s) created.` : "dry run complete."}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
