// read-only: compares the folded ledger with the rows it stands for, account by account, before LEDGER_PRUNE=1 lets any row go.
//   node scripts/checkLedgerFold.js
require("dotenv").config();
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const ledgerDays = require("../utils/ledgerDays");
const { accountBalance } = require("../utils/economy");
const { HOUSE, MINT, ESCROW, GENESIS } = require("../utils/accounts");

const GROUP = { _id: { u: "$userId", t: "$type", d: "$direction" }, ...ledgerDays.SUMS };
const FIELDS = ["count", "amount", "max", "qty", "units", "base", "full", "credit"];
// sums of fractional amounts can differ in the last bits when added in another order
const close = (a, b) => Math.abs((a || 0) - (b || 0)) <= 1e-6 * Math.max(1, Math.abs(a || 0));

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const through = await ledgerDays.watermark();
  if (!through) {
    console.log("nothing folded yet");
    return mongoose.disconnect();
  }
  console.log(`folded through ${through.toISOString()}`);

  // every row on its own, against the folded days plus the rows after the watermark
  const [raw, folded] = await Promise.all([
    Transaction.aggregate([{ $project: ledgerDays.ROW }, { $group: GROUP }]),
    ledgerDays.stream({}).then((stages) => Transaction.aggregate([...stages, { $group: GROUP }])),
  ]);
  const key = (r) => `${r._id.u}|${r._id.t}|${r._id.d}`;
  const foldedBy = new Map(folded.map((r) => [key(r), r]));
  const wrong = [];
  for (const r of raw) {
    const f = foldedBy.get(key(r));
    foldedBy.delete(key(r));
    const off = FIELDS.filter((field) => !f || !close(r[field], f[field]));
    if (!f || off.length || String(r.last) !== String(f.last)) wrong.push({ key: key(r), off, raw: r, folded: f || null });
  }
  for (const [k, f] of foldedBy) wrong.push({ key: k, off: ["only in the fold"], raw: null, folded: f });
  console.log(`${raw.length} account and type groups compared, ${wrong.length} differ`);
  for (const w of wrong.slice(0, 20)) console.log(JSON.stringify(w));

  // the system balances, the one place a whole-ledger sum is shown as a single number
  for (const [name, id] of Object.entries({ HOUSE, MINT, ESCROW, GENESIS })) {
    const [row] = await Transaction.aggregate([
      { $match: { $or: [{ userId: id }, { counterparty: id }] } },
      {
        $group: {
          _id: null,
          bal: {
            $sum: {
              $cond: [
                { $eq: ["$userId", id] },
                { $cond: [{ $eq: ["$direction", "credit"] }, "$amount", { $multiply: ["$amount", -1] }] },
                { $cond: [{ $eq: ["$direction", "credit"] }, { $multiply: ["$amount", -1] }, "$amount"] },
              ],
            },
          },
        },
      },
    ]);
    const fromRows = row ? row.bal : 0;
    const fromFold = await accountBalance(id);
    console.log(`${name}: rows ${fromRows.toFixed(2)}, folded ${fromFold.toFixed(2)}${close(fromRows, fromFold) ? "" : "  DIFFERS"}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
