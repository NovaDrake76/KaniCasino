const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
const User = require("../models/User");

const FROM = process.env.MAIL_FROM || "KaniCasino <no-reply@kanicasino.com>";
const SITE = process.env.SITE_URL || "https://kanicasino.com";
const REGION = process.env.AWS_REGION || "sa-east-1";

// unset means email is off, so a misconfigured box stays silent instead of throwing
const enabled = () => process.env.MAIL_ENABLED === "true";

let client = null;
const ses = () => (client = client || new SESv2Client({ region: REGION }));

const unsubscribeUrl = (user) => `${SITE}/unsubscribe?u=${user._id}&t=${user.unsubscribeToken}`;

// "service" is account mail nobody opts out of (password resets, policy notices);
// "marketing" needs consent and is refused without it.
async function sendMail({ to, subject, html, text, kind = "service" }) {
  if (!enabled()) return { skipped: "disabled" };

  const user = await User.findOne({ email: to }).select(
    "email marketingOptIn emailSuppressed unsubscribeToken"
  );
  if (!user) return { skipped: "unknown recipient" };
  if (user.emailSuppressed) return { skipped: "suppressed" };
  if (kind === "marketing" && !user.marketingOptIn) return { skipped: "no consent" };

  const unsub = unsubscribeUrl(user);
  const headers = [
    { Name: "List-Unsubscribe", Value: `<${unsub}>` },
    { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
  ];

  await ses().send(
    new SendEmailCommand({
      FromEmailAddress: FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: withFooter(html, unsub, kind), Charset: "UTF-8" },
            Text: { Data: `${text}\n\nUnsubscribe: ${unsub}`, Charset: "UTF-8" },
          },
          Headers: headers,
        },
      },
    })
  );
  return { sent: true };
}

function withFooter(html, unsub, kind) {
  const line =
    kind === "marketing"
      ? `You are getting this because you opted in to updates from KaniCasino. <a href="${unsub}">Unsubscribe</a>.`
      : `This is a service message about your KaniCasino account. <a href="${unsub}">Manage email preferences</a>.`;
  return `${html}<hr style="border:none;border-top:1px solid #2A2840;margin:24px 0" />
<p style="font:12px sans-serif;color:#84819a">${line}</p>`;
}

module.exports = { sendMail, unsubscribeUrl, enabled };
