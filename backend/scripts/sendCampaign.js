// sends one campaign to every account that can receive it, one message at a time.
// safe to re-run: each send is recorded and the unique index on (campaign, user) means a
// second pass skips whoever already got it rather than mailing them twice.
//
// usage (from backend/):
//   node scripts/sendCampaign.js policyUpdate                      # dry run, reports the audience
//   node scripts/sendCampaign.js policyUpdate --only a@b.com       # one address, really sends
//   node scripts/sendCampaign.js policyUpdate --apply --limit 20   # first 20, really sends
//   node scripts/sendCampaign.js policyUpdate --apply              # the whole list
require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../models/User");
const EmailSend = require("../models/EmailSend");
const { sendMail } = require("../utils/mailer");

const TEMPLATES = { policyUpdate: require("../utils/emails/policyUpdate") };

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};

const campaign = process.argv[2];
const APPLY = process.argv.includes("--apply");
const ONLY = arg("--only");
const LIMIT = Number(arg("--limit")) || 0;
// 14/sec is the account ceiling, so ~9/sec leaves room for live traffic sending too
const GAP_MS = Number(arg("--gap")) || 110;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const template = TEMPLATES[campaign];
  if (!template) {
    console.error(`unknown campaign "${campaign}". known: ${Object.keys(TEMPLATES).join(", ")}`);
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (run from backend/ with its .env)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  await EmailSend.syncIndexes();

  const filter = ONLY
    ? { email: ONLY }
    : {
        email: { $exists: true, $nin: [null, ""] },
        emailSuppressed: { $ne: true },
        ...(template.audience || {}),
      };

  const already = new Set(
    (await EmailSend.find({ campaign, status: "sent" }).select("user")).map((r) => String(r.user))
  );

  let audience = await User.find(filter).select("username email").sort({ _id: 1 });
  audience = audience.filter((u) => !already.has(String(u._id)));
  if (LIMIT) audience = audience.slice(0, LIMIT);

  console.log(`campaign: ${campaign}`);
  console.log(`subject:  ${template.subject}`);
  console.log(`already sent in a previous run: ${already.size}`);
  console.log(`to send now: ${audience.length}`);

  const live = APPLY || ONLY;
  if (!live) {
    console.log("\nDRY RUN: nothing sent. re-run with --apply");
    console.log("sample:", audience.slice(0, 5).map((u) => u.email));
    process.exit(0);
  }

  const tally = { sent: 0, skipped: 0, failed: 0 };
  for (let i = 0; i < audience.length; i++) {
    const u = audience[i];
    const { subject, html, text } = template.build(u.username);
    let status = "sent";
    let detail;

    try {
      const res = await sendMail({ to: u.email, subject, html, text, kind: "service" });
      if (res.skipped) {
        status = "skipped";
        detail = res.skipped;
      }
    } catch (err) {
      status = "failed";
      detail = err.message;
    }

    tally[status] += 1;
    // a duplicate key here means another run already covered this user, which is fine
    await EmailSend.create({ campaign, user: u._id, email: u.email, status, detail }).catch(() => {});

    if ((i + 1) % 50 === 0 || i === audience.length - 1) {
      console.log(`${i + 1}/${audience.length}  sent ${tally.sent}  skipped ${tally.skipped}  failed ${tally.failed}`);
    }
    if (i < audience.length - 1) await sleep(GAP_MS);
  }

  console.log(`\ndone. sent ${tally.sent}, skipped ${tally.skipped}, failed ${tally.failed}`);
  if (tally.failed) console.log("re-run the same command to retry only the ones that did not send");
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
