const SITE = process.env.SITE_URL || "https://kanicasino.com";

// the same people as the 1.0 notice: google accounts, the only confirmed addresses
const { audience } = require("./policyUpdate");

const subject = "KaniCasino 1.2 and updates to our Privacy Policy";

// tagged so analytics can tell a visit from this email apart from one typed in by hand
const CAMPAIGN = "utm_source=email&utm_medium=email&utm_campaign=kanicasino-1-2";
const tagged = (path) => `${SITE}${path}?${CAMPAIGN}`;

// a username is free text, so it is escaped before it goes into the markup
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const P = "margin:0 0 16px;font-size:15px;line-height:1.65;color:#3C3A4B";

const build = (name) => {
  const policy = `${SITE}/privacy-policy`;
  const terms = `${SITE}/terms`;

  const html = `
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F1F0F5;opacity:0">We have updated our Privacy Policy.</div>
<div style="background:#F1F0F5;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto">
    <div style="font:700 20px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#4F46E5;padding:0 8px 20px">KaniCasino</div>
    <div style="background:#FFFFFF;border-radius:10px;overflow:hidden">
    <a href="${tagged("/")}"><img src="${SITE}/images/email/daisu-banner.jpg" width="560" alt="KaniCasino 1.2" style="display:block;width:100%;max-width:560px;height:auto;border:0" /></a>
    <div style="padding:34px 32px 36px">
      <h1 style="margin:0 0 28px;font-size:23px;line-height:1.3;color:#16151F">KaniCasino 1.2 and updates to our Privacy Policy</h1>

      <p style="${P}"><strong>Hi, ${escape(name)}!</strong></p>

      <p style="${P}">We are writing to let you know that we have updated our Privacy Policy to enhance transparency and to continue providing a safer and more comfortable experience on KaniCasino.</p>

      <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#3C3A4B">You can review the updated policies at any time using the links below:</p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 14px">
        <tr><td align="center" bgcolor="#4F46E5" style="border-radius:6px">
          <a href="${tagged("/privacy-policy")}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none">Read the Privacy Policy &#8594;</a>
        </td></tr>
      </table>
      <p style="margin:0 0 28px;font-size:14px;line-height:1.65"><a href="${tagged("/terms")}" style="color:#4F46E5;font-weight:600;text-decoration:none">Read the Terms of Service &#8594;</a></p>

      <p style="margin:0;font-size:15px;line-height:1.65;color:#3C3A4B">As always, thanks for playing! We'll be waiting for you.</p>
    </div>
    </div>
  </div>
</div>`;

  const text = `KaniCasino 1.2 and updates to our Privacy Policy

Hi, ${name}!

We are writing to let you know that we have updated our Privacy Policy to enhance transparency and to continue providing a safer and more comfortable experience on KaniCasino.

You can review the updated policies at any time using the links below:

Privacy Policy: ${policy}
Terms of Service: ${terms}

As always, thanks for playing! We'll be waiting for you.`;

  return { subject, html, text };
};

module.exports = { subject, audience, build };
