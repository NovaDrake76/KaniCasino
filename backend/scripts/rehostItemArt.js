// Repoints stored art urls at our own bucket, from a manifest of {oldUrl: newUrl}.
//
//   node scripts/rehostItemArt.js ../art-manifest.json            (dry run)
//   node scripts/rehostItemArt.js ../art-manifest.json --apply
//
// Dry run by default. Idempotent: a url already repointed no longer matches anything.
// Inventory copies are left alone on purpose, because the catalog is what the app reads
// an item's image from; a copy taken at drop time is already allowed to be stale.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const [, , manifestPath] = process.argv;
const APPLY = process.argv.includes("--apply");

// one find and one bulkWrite per collection, rather than a query per url
async function flat(db, collection, field, manifest, keys) {
  const rows = await db
    .collection(collection)
    .find({ [field]: { $in: keys } }, { projection: { [field]: 1 } })
    .toArray();
  if (!APPLY || !rows.length) return rows.length;

  const res = await db.collection(collection).bulkWrite(
    rows.map((row) => ({
      updateOne: { filter: { _id: row._id }, update: { $set: { [field]: manifest[row[field]] } } },
    })),
    { ordered: false }
  );
  return res.modifiedCount;
}

// predictions carry art on each outcome as well as on the market itself
async function nested(db, manifest, keys) {
  const rows = await db
    .collection("predictions")
    .find({ "outcomes.image": { $in: keys } }, { projection: { "outcomes.image": 1 } })
    .toArray();
  let changed = 0;
  for (const row of rows) {
    const updates = (row.outcomes || [])
      .map((outcome, index) => [index, manifest[outcome && outcome.image]])
      .filter(([, next]) => next);
    if (!updates.length) continue;
    changed += 1;
    if (!APPLY) continue;
    const $set = {};
    for (const [index, next] of updates) $set[`outcomes.${index}.image`] = next;
    await db.collection("predictions").updateOne({ _id: row._id }, { $set });
  }
  return changed;
}

async function main() {
  if (!manifestPath) {
    console.error("usage: node scripts/rehostItemArt.js <manifest.json> [--apply]");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), "utf8"));
  const keys = Object.keys(manifest);
  console.log(`${APPLY ? "applying" : "DRY RUN over"} ${keys.length} urls`);

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  for (const [collection, field] of [["items", "image"], ["cases", "image"], ["fanboards", "image"], ["predictions", "image"]]) {
    console.log(`${String(await flat(db, collection, field, manifest, keys)).padStart(6)}  ${collection}.${field}`);
  }
  console.log(`${String(await nested(db, manifest, keys)).padStart(6)}  predictions.outcomes[].image`);

  const left = await db.collection("items").countDocuments({ image: /steamstatic\.com/ });
  console.log(`\nitems still pointing at steam: ${left}`);
  if (!APPLY) console.log("nothing was written. re-run with --apply");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
