const express = require("express");
const https = require("https");
const User = require("../models/User");
const { isAuthenticated } = require("../middleware/authMiddleware");

const router = express.Router();

// Gmail's one-click unsubscribe POSTs here with no session, so the token in the link
// is the only credential. it only ever turns marketing off.
async function optOut(userId, token) {
  if (!userId || !token) return false;
  const res = await User.updateOne(
    { _id: userId, unsubscribeToken: String(token) },
    { $set: { marketingOptIn: false } }
  );
  return res.matchedCount > 0;
}

router.post("/unsubscribe", async (req, res) => {
  const ok = await optOut(req.query.u || req.body.u, req.query.t || req.body.t);
  res.status(ok ? 200 : 404).json({ unsubscribed: ok });
});

router.get("/unsubscribe", async (req, res) => {
  const ok = await optOut(req.query.u, req.query.t);
  res.status(ok ? 200 : 404).json({ unsubscribed: ok });
});

router.get("/preferences", isAuthenticated, async (req, res) => {
  const user = await User.findById(req.user._id).select("marketingOptIn emailSuppressed");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ marketingOptIn: !!user.marketingOptIn, emailSuppressed: !!user.emailSuppressed });
});

router.put("/preferences", isAuthenticated, async (req, res) => {
  const optIn = req.body.marketingOptIn === true;
  await User.updateOne(
    { _id: req.user._id },
    { $set: { marketingOptIn: optIn, marketingOptInAt: optIn ? new Date() : null } }
  );
  res.json({ marketingOptIn: optIn });
});

// SES publishes delivery events here through SNS. a hard bounce or a complaint
// suppresses the address permanently: continuing to mail either one is what destroys
// a sending domain's reputation.
router.post("/ses-events", express.text({ type: "*/*" }), async (req, res) => {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (body.Type === "SubscriptionConfirmation" && body.SubscribeURL) {
      https.get(body.SubscribeURL, () => {}).on("error", () => {});
      return res.json({ confirmed: true });
    }

    const message = typeof body.Message === "string" ? JSON.parse(body.Message) : body.Message || {};
    const suppress = async (addresses, reason) => {
      if (!addresses || !addresses.length) return;
      await User.updateMany(
        { email: { $in: addresses } },
        { $set: { emailSuppressed: true, emailSuppressedReason: reason, emailSuppressedAt: new Date() } }
      );
    };

    if (message.notificationType === "Bounce" && message.bounce?.bounceType === "Permanent") {
      await suppress((message.bounce.bouncedRecipients || []).map((r) => r.emailAddress), "bounce");
    } else if (message.notificationType === "Complaint") {
      await suppress((message.complaint.complainedRecipients || []).map((r) => r.emailAddress), "complaint");
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("ses-events:", err.message);
    res.json({ ok: true }); // never make SNS retry a message we cannot parse
  }
});

module.exports = router;
