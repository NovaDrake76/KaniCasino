// rewrite an existing case's roster from an importCases spec. importCases skips a case
// whose title already exists; this is the path for replacing what a live case drops.
//
// usage:  node scripts/rebuildCase.js <spec.json> <case title> [--commit]
//   dry run by default, and the dry run reports how many inventory copies and market
//   listings point at the outgoing items so the blast radius is visible before writing.
//
// old Item docs are never deleted. sell, marketplace and collections all read baseValue
// off the live Item doc by _id, so deleting one would break every copy already owned.
// they are only detached from the case, which stops them dropping.
const mongoose = require("mongoose");
require("dotenv").config();
const fs = require("fs");
const Case = require("../models/Case");
const Item = require("../models/Item");
const User = require("../models/User");
const Marketplace = require("../models/Marketplace");
const BuyOrder = require("../models/BuyOrder");
const { recomputeCaseValues } = require("../utils/itemValue");

async function main() {
  const [specPath, title] = process.argv.slice(2);
  const commit = process.argv.includes("--commit");
  if (!specPath || !title) {
    console.error("usage: node scripts/rebuildCase.js <spec.json> <case title> [--commit]");
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const entry = Object.entries(spec).find(([k, d]) => (d.title || `${k} Case`) === title);
  if (!entry) {
    console.error(`"${title}" is not in ${specPath}`);
    process.exit(1);
  }
  const def = entry[1];

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (run where backend/.env is available)");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(commit ? "== COMMIT: writing to the database ==\n" : "== DRY RUN (pass --commit to write) ==\n");

  const caseDoc = await Case.findOne({ title });
  if (!caseDoc) {
    console.error(`no case titled "${title}" — use importCases.js to create it`);
    process.exit(1);
  }

  const oldIds = (caseDoc.items || []).map(String);
  const oldItems = await Item.find({ _id: { $in: oldIds } }, { name: 1 }).lean();
  const owned = await User.aggregate([
    { $unwind: "$inventory" },
    { $match: { "inventory._id": { $in: oldItems.map((i) => i._id) } } },
    { $group: { _id: "$inventory._id", copies: { $sum: 1 }, holders: { $addToSet: "$_id" } } },
  ]);
  const itemIds = oldItems.map((i) => i._id);
  const listed = await Marketplace.countDocuments({ item: { $in: itemIds } });
  const orders = await BuyOrder.countDocuments({ item: { $in: itemIds }, status: "open" });
  const copies = owned.reduce((s, o) => s + o.copies, 0);
  const holders = new Set(owned.flatMap((o) => o.holders.map(String))).size;

  console.log(`"${title}"  ${caseDoc.price} KP -> ${def.price} KP`);
  console.log(`  outgoing roster: ${oldIds.length} items`);
  console.log(`  incoming roster: ${def.items.length} items`);
  console.log(`  already owned:   ${copies} copies across ${holders} player(s)`);
  console.log(`  market listings: ${listed}`);
  console.log(`  open buy orders: ${orders}`);
  console.log(`\n  the ${oldIds.length} outgoing Item docs stay in the database (owned copies keep`);
  console.log(`  resolving their value); they are only detached so they stop dropping.`);

  const tiers = def.items.reduce((m, i) => ((m[i.rarity] = (m[i.rarity] || 0) + 1), m), {});
  console.log(`\n  new tiers: ${JSON.stringify(tiers)}`);
  if (!commit) {
    await mongoose.disconnect();
    console.log("\ndry run complete.");
    return;
  }

  const items = await Item.insertMany(
    def.items.map((i) => ({ name: i.name, image: i.image, rarity: String(i.rarity), case: caseDoc._id }))
  );
  await Case.updateOne(
    { _id: caseDoc._id },
    { $set: { items: items.map((i) => i._id), price: def.price, image: def.cover || caseDoc.image, category: def.category || caseDoc.category } }
  );
  await recomputeCaseValues(caseDoc._id);
  await mongoose.disconnect();
  console.log(`\ndone: ${title} rebuilt with ${items.length} items, ${oldIds.length} detached.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
