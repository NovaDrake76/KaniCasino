const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { accountBalance, TX } = require("../utils/economy");
const { GENESIS } = require("../utils/accounts");

// book each account's pre-ledger balance as one opening_balance row against genesis, so
// replaying the ledger reproduces the wallet and reconcile goes to zero. drift is
// invariant under atomic money moves, so this is safe to run while players are betting.
async function bookGenesis({ dryRun = false } = {}) {
  let total = 0;
  let booked = 0;
  let skipped = 0;
  let openedTotal = 0;

  const cursor = User.find({}, { walletBalance: 1 }).cursor();
  for (let u = await cursor.next(); u; u = await cursor.next()) {
    total += 1;

    // idempotent: an account already given its opening is left alone, so re-runs are safe
    if (await Transaction.exists({ userId: u._id, type: TX.OPENING })) {
      skipped += 1;
      continue;
    }

    const drift = u.walletBalance - (await accountBalance(u._id));
    if (drift === 0) {
      skipped += 1;
      continue;
    }

    openedTotal += drift;
    if (!dryRun) {
      await Transaction.create({
        userId: u._id,
        type: TX.OPENING,
        direction: drift > 0 ? "credit" : "debit",
        amount: Math.abs(drift),
        balanceAfter: u.walletBalance,
        counterparty: GENESIS,
        meta: { reason: "pre-ledger opening balance" },
      });
    }
    booked += 1;
  }

  return { total, booked, skipped, openedTotal };
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (run from backend/ with its .env)");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  await mongoose.connect(process.env.MONGO_URI);
  const report = await bookGenesis({ dryRun });
  console.log(JSON.stringify({ dryRun, ...report }, null, 2));
  await mongoose.disconnect();
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { bookGenesis };
