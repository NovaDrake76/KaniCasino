// benchmarks the missions context aggregate against a synthetic ledger, so the covering
// index can be judged before anything is created on production.
//
//   node scripts/benchMissionsAggregate.mjs [rows]
//
// the aggregate today plans as IXSCAN -> FETCH -> GROUP: the index finds the user's rows
// and then every one of them is fetched to read type, amount and meta.quantity. an index
// carrying those fields answers it without touching a document.
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";

const ROWS = Number(process.argv[2] || 120000);
const TYPES = ["dice_bet", "dice_win", "plinko_bet", "plinko_win", "case_open", "bonus", "blackjack_bet"];

const mongod = await MongoMemoryServer.create();
const client = await MongoClient.connect(mongod.getUri());
const db = client.db("bench");
const tx = db.collection("transactions");

const userId = "u1";
const launch = new Date(Date.now() - 400 * 864e5);
console.log(`seeding ${ROWS.toLocaleString()} rows...`);
for (let i = 0; i < ROWS; i += 10000) {
  const batch = [];
  for (let k = 0; k < Math.min(10000, ROWS - i); k++) {
    batch.push({
      userId,
      type: TYPES[(i + k) % TYPES.length],
      direction: (i + k) % 2 ? "credit" : "debit",
      amount: Math.round(Math.random() * 5000),
      balanceAfter: 1000,
      meta: { quantity: ((i + k) % 5) + 1 },
      createdAt: new Date(launch.getTime() + (i + k) * 1000),
    });
  }
  await tx.insertMany(batch, { ordered: false });
}
// a second user, so the index actually has to select
await tx.insertMany(Array.from({ length: 5000 }, (_, i) => ({
  userId: "u2", type: "dice_bet", direction: "debit", amount: 1, balanceAfter: 1,
  meta: { quantity: 1 }, createdAt: new Date(launch.getTime() + i * 1000),
})), { ordered: false });

const pipeline = [
  { $match: { userId, createdAt: { $gte: launch } } },
  {
    $group: {
      _id: "$type", count: { $sum: 1 },
      qty: { $sum: { $ifNull: ["$meta.quantity", 0] } },
      maxAmount: { $max: "$amount" }, sumAmount: { $sum: "$amount" },
    },
  },
];

const plan = async () => {
  const e = await db.command({ explain: { aggregate: "transactions", pipeline, cursor: {} }, verbosity: "executionStats" });
  const s = JSON.stringify(e);
  const stages = [...new Set((s.match(/"stage"\s*:\s*"([A-Z_]+)"/g) || []).map((x) => x.split('"')[3]))];
  const docs = (s.match(/"totalDocsExamined"\s*:\s*(\d+)/) || [])[1];
  return { stages: stages.join(" <- "), docs: Number(docs || 0) };
};

const timeIt = async (label) => {
  await tx.aggregate(pipeline).toArray();                       // warm
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const t0 = process.hrtime.bigint();
    await tx.aggregate(pipeline).toArray();
    runs.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  runs.sort((a, b) => a - b);
  const p = await plan();
  console.log(`\n${label}`);
  console.log(`  plan            ${p.stages}`);
  console.log(`  docs examined   ${p.docs.toLocaleString()}`);
  console.log(`  median          ${runs[2].toFixed(0)} ms   (best ${runs[0].toFixed(0)}, worst ${runs[4].toFixed(0)})`);
};

await tx.createIndex({ userId: 1, createdAt: -1 });
await timeIt("today: { userId, createdAt }");

await tx.createIndex(
  { userId: 1, createdAt: -1, type: 1, amount: 1, "meta.quantity": 1 },
  { name: "missionsCovering" }
);
await timeIt("with the covering index");

const sizes = await db.command({ collStats: "transactions" });
console.log("\nindex sizes:");
for (const [name, bytes] of Object.entries(sizes.indexSizes)) {
  console.log(`  ${name.padEnd(46)} ${(bytes / 1048576).toFixed(1)} MB`);
}

await client.close();
await mongod.stop();
