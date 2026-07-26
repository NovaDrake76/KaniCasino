const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
const User = require("../models/User");

const FROM = process.env.MAIL_FROM || "KaniCasino <no-reply@kanicasino.com>";
// the from address can send but cannot receive, so replies need somewhere real to go
const REPLY_TO = process.env.MAIL_REPLY_TO;
const SITE = process.env.SITE_URL || "https://kanicasino.com";
const API = process.env.API_URL || "https://kanicasino.cfhxo.com";
const REGION = process.env.AWS_REGION || "sa-east-1";

// unset means email is off, so a misconfigured box stays silent instead of throwing
const enabled = () => process.env.MAIL_ENABLED === "true";

let client = null;
const ses = () => (client = client || new SESv2Client({ region: REGION }));

const unsubscribeUrl = (user) => `${SITE}/unsubscribe?u=${user._id}&t=${user.unsubscribeToken}`;

// the header URL is POSTed by the mail provider itself, so it has to be the api and not
// the SPA, which would answer 200 with a page nobody runs and drop the opt-out.
const oneClickUrl = (user) => `${API}/email/unsubscribe?u=${user._id}&t=${user.unsubscribeToken}`;

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
    { Name: "List-Unsubscribe", Value: `<${oneClickUrl(user)}>` },
    { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
  ];

  await ses().send(
    new SendEmailCommand({
      FromEmailAddress: FROM,
      Destination: { ToAddresses: [to] },
      ...(REPLY_TO ? { ReplyToAddresses: [REPLY_TO] } : {}),
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
  return `${html}
<div style="background:#F1F0F5;padding:0 16px 32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <p style="max-width:560px;margin:0 auto;padding:0 8px;font-size:12px;line-height:1.6;color:#6B6880">${line}</p>
</div>`;
}

module.exports = { sendMail, unsubscribeUrl, oneClickUrl, enabled };
