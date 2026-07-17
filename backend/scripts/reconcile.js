const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");
const { accountBalance, ledgerSupply } = require("../utils/economy");
const { HOUSE, MINT, ESCROW, GENESIS } = require("../utils/accounts");

// read-only audit: derive each account from the ledger and compare players against their
// stored wallet. legacy accounts have no opening row, so drift is expected until genesis.
async function reconcile() {
  const users = await User.find({}, { walletBalance: 1 }).lean();
  let drifting = 0;
  let totalDrift = 0;
  const worst = [];

  for (const u of users) {
    const derived = await accountBalance(u._id);
    const drift = u.walletBalance - derived;
    if (drift !== 0) {
      drifting += 1;
      totalDrift += drift;
      worst.push({ userId: String(u._id), wallet: u.walletBalance, derived, drift });
    }
  }
  worst.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

  const [house, mint, escrow, genesis, supply] = await Promise.all([
    accountBalance(HOUSE),
    accountBalance(MINT),
    accountBalance(ESCROW),
    accountBalance(GENESIS),
    ledgerSupply(),
  ]);

  return {
    players: { total: users.length, drifting, totalDrift },
    system: { house, mint, escrow, genesis, supply },
    worst: worst.slice(0, 20),
  };
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (run from backend/ with its .env)");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const report = await reconcile();
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { reconcile };
