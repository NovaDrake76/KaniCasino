require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

// disables accounts by id. a disabled account keeps every row it owns, so the ledger, the
// fan boards and the market history all stay consistent; it simply cannot be used again.
// deleting would tear holes in all three and is not reversible.
//
// bumping tokenVersion is what makes it take effect now rather than in thirty days: every
// jwt already issued to that account stops verifying on the next request.
//
// usage:
//   node scripts/disableUsers.js --reason "slur in username" <id> <id> ...
//   node scripts/disableUsers.js --undo <id>
//   add --dry to print what it would do and change nothing
async function disable(ids, { reason = "terms of use", undo = false, dry = false } = {}) {
  const done = [];
  for (const id of ids) {
    const user = await User.findById(id).select("username disabled tokenVersion").lean();
    if (!user) {
      done.push({ id, result: "no such account" });
      continue;
    }
    if (!undo && user.disabled) {
      done.push({ id, username: user.username, result: "already disabled" });
      continue;
    }
    if (dry) {
      done.push({ id, username: user.username, result: undo ? "would enable" : "would disable" });
      continue;
    }

    await User.updateOne(
      { _id: id },
      undo
        ? { $set: { disabled: false }, $unset: { disabledAt: "", disabledReason: "" } }
        : {
            $set: { disabled: true, disabledAt: new Date(), disabledReason: reason },
            // kills every token already issued to this account
            $inc: { tokenVersion: 1 },
          }
    );
    done.push({ id, username: user.username, result: undo ? "enabled" : "disabled" });
  }
  return done;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const undo = argv.includes("--undo");
  const dry = argv.includes("--dry");
  const reasonAt = argv.indexOf("--reason");
  const reason = reasonAt >= 0 ? argv[reasonAt + 1] : "terms of use";
  const ids = argv.filter(
    (a, i) => !a.startsWith("--") && !(reasonAt >= 0 && i === reasonAt + 1)
  );

  if (!ids.length) {
    console.error("give at least one user id");
    process.exit(1);
  }

  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => disable(ids, { reason, undo, dry }))
    .then((rows) => {
      for (const r of rows) console.log(`  ${r.id}  ${r.username || "?"}  ${r.result}`);
      return mongoose.disconnect();
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { disable };
