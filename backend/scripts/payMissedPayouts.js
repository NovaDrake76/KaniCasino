// Pays out plinko wins whose credit was rolled back by a write conflict.
//
// A credit that loses its transaction leaves the stake taken and the winnings unpaid; the
// roll is still on record, so the roll is what this reconciles against. Dry run by default:
//   node scripts/payMissedPayouts.js                 # report only
//   node scripts/payMissedPayouts.js --apply         # actually pay
//   node scripts/payMissedPayouts.js --from ... --to ...
//
// Safe to run twice. A roll it has already settled carries `meta.reconciledRoll`, and a
// roll whose original credit did land is matched against the existing win row.
require("dotenv").config();
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { creditUser, probeTransactions, setTransactionsSupported, TX } = require("../utils/economy");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const APPLY = process.argv.includes("--apply");
const FROM = new Date(arg("--from", "2026-08-22T12:00:00Z"));
const TO = new Date(arg("--to", "2026-08-22T12:30:00Z"));
// credits are searched far wider than the rolls, so a payout that landed just outside the
// window is never mistaken for a missing one
const PAD_MS = 2 * 60 * 60 * 1000;

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  setTransactionsSupported(await probeTransactions());
  const db = mongoose.connection.db;

  const rolls = await db
    .collection("rolls")
    .find({ game: "plinko", createdAt: { $gte: FROM, $lte: TO } })
    .toArray();
  const owed = rolls.filter((r) => r.outcome && Number(r.outcome.payout) > 0);

  const wins = await db
    .collection("transactions")
    .find({
      type: TX.PLINKO_WIN,
      createdAt: { $gte: new Date(FROM.getTime() - PAD_MS), $lte: new Date(TO.getTime() + PAD_MS) },
    })
    .toArray();

  // already settled by an earlier run of this script
  const settled = new Set(wins.map((t) => t.meta && t.meta.reconciledRoll).filter(Boolean));

  // one win row can only account for one roll, so matching consumes it
  const pool = new Map();
  wins
    .filter((t) => !(t.meta && t.meta.reconciledRoll))
    .forEach((t) => {
      const key = `${t.userId}|${t.amount}`;
      pool.set(key, (pool.get(key) || 0) + 1);
    });

  const missing = [];
  for (const roll of owed) {
    if (settled.has(roll.rollId)) continue;
    const key = `${roll.userId}|${roll.outcome.payout}`;
    const held = pool.get(key) || 0;
    if (held > 0) pool.set(key, held - 1);
    else missing.push(roll);
  }

  const total = missing.reduce((sum, r) => sum + Number(r.outcome.payout), 0);
  console.log(`plinko rolls ${FROM.toISOString()} .. ${TO.toISOString()}: ${rolls.length}, owed a payout: ${owed.length}`);
  console.log(`unpaid: ${missing.length} rolls, ${total} KP`);
  for (const r of missing) {
    console.log(`  ${r.rollId}  user=${r.userId}  payout=${r.outcome.payout}`);
  }
  if (!missing.length || !APPLY) {
    console.log(APPLY ? "nothing to pay" : "\ndry run, nothing written. pass --apply to pay.");
    return;
  }

  const byUser = new Map();
  for (const roll of missing) {
    const payout = Number(roll.outcome.payout);
    const user = await creditUser(roll.userId, payout, payout, {
      type: TX.PLINKO_WIN,
      meta: {
        betAmount: roll.outcome.betAmount,
        risk: roll.outcome.risk,
        bin: roll.outcome.bin,
        payout,
        reconciledRoll: roll.rollId,
        reason: "credit lost to a write conflict",
      },
    });
    if (!user) {
      console.log(`  FAILED ${roll.rollId}, leaving it for the next run`);
      continue;
    }
    console.log(`  paid ${roll.rollId}  ${payout} KP  -> ${user.username}`);
    const seen = byUser.get(String(roll.userId)) || { kp: 0, n: 0 };
    byUser.set(String(roll.userId), { kp: seen.kp + payout, n: seen.n + 1 });
  }

  // the player watched a drop land and pay nothing, so tell them it has been put right
  for (const [userId, v] of byUser) {
    await Notification.create({
      senderId: userId,
      receiverId: userId,
      type: "alert",
      title: "Plinko payout restored",
      content: `${v.n} of your plinko wins failed to pay out during a server fault. K₽${v.kp} has been added to your balance.`,
    });
  }
  console.log(`\ndone: ${byUser.size} players, ${[...byUser.values()].reduce((s, v) => s + v.kp, 0)} KP`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
