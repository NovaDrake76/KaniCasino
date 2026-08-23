// One-off cleanup for data the current code no longer creates.
//
//   node scripts/reclaimStorage.js           # report only
//   node scripts/reclaimStorage.js --apply   # write
//
// Two things, both safe because nothing reads what they remove:
//
//   Retired seed chains still hold all ten thousand of their spent seeds, 732 kB each.
//   Every seed is sha256 of the next, so the whole sequence regenerates from the last
//   one; consumeNextSeed only ever looks at the active chain, and crash and coin flip
//   verify against the serverSeed stored on the round itself.
//
//   Five indexes the planner has never chosen. Mongoose creates indexes but never drops
//   them, so taking them out of a schema leaves them on the cluster until something does.
require("dotenv").config();
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

// checked against $indexStats before anything drops. `covered` names the index that can
// serve every query this one can, which is the only reason to drop one the planner still
// picks: a prefix is never the sole option, it is just sometimes the narrower choice.
const DEAD_INDEXES = [
  { collection: "rounds", index: "bets.userId_1_createdAt_-1" },
  { collection: "transactions", index: "userId_1", covered: "userId_1_createdAt_-1" },
  { collection: "fanboards", index: "fanCount_-1" },
  { collection: "fanboards", index: "gap_1" },
  { collection: "marketsales", index: "soldAt_-1", covered: "item_1_soldAt_-1" },
];

const mb = (bytes) => (bytes / 1048576).toFixed(2);

async function compactChains(db) {
  const chains = db.collection("gameseedchains");
  const stale = await chains
    .aggregate([
      { $match: { active: false, "seeds.0": { $exists: true } } },
      { $project: { game: 1, cursor: 1, n: { $size: "$seeds" }, bytes: { $bsonSize: "$$ROOT" } } },
    ])
    .toArray();

  if (!stale.length) return console.log("seed chains: nothing to compact");

  const bytes = stale.reduce((sum, c) => sum + c.bytes, 0);
  const spent = stale.filter((c) => c.cursor >= c.n).length;
  console.log(`seed chains: ${stale.length} retired chains holding ${mb(bytes)} MB (${spent} fully consumed)`);

  if (!APPLY) return console.log("           run with --apply to compact them");

  const res = await chains.updateMany({ active: false, "seeds.0": { $exists: true } }, [
    { $set: { rootSeed: { $ifNull: [{ $last: "$seeds" }, "$rootSeed" ] }, seeds: [] } },
  ]);
  const missing = await chains.countDocuments({ active: false, rootSeed: { $in: [null, ""] } });
  console.log(`           compacted ${res.modifiedCount}, ${missing} left without a root`);
}

async function dropIndexes(db) {
  for (const { collection: name, index, covered } of DEAD_INDEXES) {
    const collection = db.collection(name);
    let stats;
    try {
      stats = await collection.aggregate([{ $indexStats: {} }]).toArray();
    } catch {
      console.log(`${name}.${index}: could not read usage, skipped`);
      continue;
    }
    const row = stats.find((s) => s.name === index);
    if (!row) {
      console.log(`${name}.${index}: already gone`);
      continue;
    }
    // the counter resets on restart, so this is a guard against an obvious mistake rather
    // than proof. an index with a wider one covering it is allowed to be busy: dropping it
    // moves those queries onto the other, it does not leave them without a plan.
    if (row.accesses.ops > 0 && !covered) {
      console.log(`${name}.${index}: ${row.accesses.ops} ops since the last restart, LEFT ALONE`);
      continue;
    }
    if (covered && !stats.some((s) => s.name === covered)) {
      console.log(`${name}.${index}: ${covered} is missing, LEFT ALONE`);
      continue;
    }
    const why = covered ? `${row.accesses.ops} ops, covered by ${covered}` : "unused";
    if (!APPLY) {
      console.log(`${name}.${index}: ${why}, would drop`);
      continue;
    }
    await collection.dropIndex(index);
    console.log(`${name}.${index}: dropped`);
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const before = await db.stats();
  console.log(`${APPLY ? "APPLYING" : "dry run"} - logical ${mb(before.dataSize + before.indexSize)} MB of 512 MB\n`);

  await compactChains(db);
  console.log("");
  await dropIndexes(db);

  const after = await db.stats();
  const freed = before.dataSize + before.indexSize - (after.dataSize + after.indexSize);
  console.log(`\nlogical ${mb(after.dataSize + after.indexSize)} MB of 512 MB${APPLY ? `, freed ${mb(freed)} MB` : ""}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
