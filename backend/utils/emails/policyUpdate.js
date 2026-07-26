const SITE = process.env.SITE_URL || "https://kanicasino.com";

const subject = "KaniCasino 1.0, and an updated Privacy Policy";

// google accounts only. nothing else here is a confirmed address, and mailing unverified
// ones would put the bounce rate, and the sending domain with it, at risk on the first run.
// google never sets a password, and no route has ever written one after registration.
const audience = {
  $or: [{ googleId: { $exists: true, $nin: [null, ""] } }, { password: { $in: [null, ""] } }, { password: { $exists: false } }],
};

const build = (name) => {
  const url = `${SITE}/privacy-policy`;

  const html = `
<div style="background:#F1F0F5;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto">
    <div style="font:700 20px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#4F46E5;padding:0 8px 20px">KaniCasino</div>
    <div style="background:#FFFFFF;border-radius:10px;padding:36px 32px">
      <h1 style="margin:0 0 28px;font-size:23px;line-height:1.3;color:#16151F">KaniCasino 1.0 is here, with a new Privacy Policy</h1>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3C3A4B"><strong>Hi, ${name}!</strong></p>

      <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#3C3A4B">KaniCasino has reached its first stable release. Alongside it we have rewritten our Privacy Policy, and we want you to know what it says:</p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0">
        <tr><td align="center" bgcolor="#4F46E5" style="border-radius:6px">
          <a href="${url}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none">Read the Privacy Policy &#8594;</a>
        </td></tr>
      </table>

      <h2 style="margin:32px 0 10px;font-size:17px;color:#16151F">What changed?</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3C3A4B">The new policy properly describes how KaniCasino works. It sets out what your account holds, why we keep it, which companies process it for us, how long it is kept, and how to ask for a copy of your data or have it deleted under the LGPD.</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3C3A4B">You can also now choose whether to hear about new cases and games by email. That is off unless you turn it on, under Settings in your profile.</p>

      <h2 style="margin:32px 0 10px;font-size:17px;color:#16151F">What do I need to do now?</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3C3A4B">Nothing. Your account and the way you play are unchanged. KP is still fictional, there are no deposits or withdrawals, and we never ask for payment details.</p>

      <p style="margin:24px 0 0;font-size:15px;line-height:1.65;color:#3C3A4B">If anything here is unclear, just reply to this email and we will explain.</p>
    </div>
  </div>
</div>`;

  const text = `KaniCasino 1.0 is here, with a new Privacy Policy

Hi, ${name}!

KaniCasino has reached its first stable release. Alongside it we have rewritten our Privacy Policy, and we want you to know what it says. You can read it in full here:
${url}

What changed?
The new policy properly describes how KaniCasino works. It sets out what your account holds, why we keep it, which companies process it for us, how long it is kept, and how to ask for a copy of your data or have it deleted under the LGPD.

You can also now choose whether to hear about new cases and games by email. That is off unless you turn it on, under Settings in your profile.

What do I need to do now?
Nothing. Your account and the way you play are unchanged. KP is still fictional, there are no deposits or withdrawals, and we never ask for payment details.

If anything here is unclear, just reply to this email and we will explain.`;

  return { subject, html, text };
};

module.exports = { subject, audience, build };
