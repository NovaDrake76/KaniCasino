const fs = require("fs");
const path = require("path");
const dns = require("dns");

// a domain's mail servers barely change, so a lookup is kept for hours rather than repeated per signup
const MX_TTL_MS = 6 * 60 * 60 * 1000;
const DNS_TIMEOUT_MS = 3000;

const DISPOSABLE = new Set(
  fs
    .readFileSync(path.join(__dirname, "disposableDomains.txt"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line && !line.startsWith("#"))
);
// throwaway domains farm accounts used here that the public list does not carry yet
for (const d of ["minafter.com", "bocably.com", "ebflyai.com", "mgil.com", "fna6.com", "eqvox.com", "noefa.com", "cazlv.com", "kernuo.com", "tawjdm.com", "morxin.com", "jadsys.com", "fdfdkdkf.com"]) DISPOSABLE.add(d);

// the inboxes a typo most often meant, for the "did you mean" hint
const POPULAR = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com", "hotmail.com.br", "yahoo.com.br", "outlook.com.br", "proton.me", "protonmail.com", "uol.com.br", "bol.com.br"];

const domainOf = (email) => String(email || "").trim().toLowerCase().split("@")[1] || "";

// one inbox, however it is written: gmail ignores dots and anything after a plus, most providers ignore the plus
function mailbox(email) {
  let [local, domain] = String(email || "").trim().toLowerCase().split("@");
  if (!local || !domain) return null;
  local = local.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

// every spelling of a gmail inbox matches this, so a google account can be found from the folded form
function mailboxPattern(box) {
  const [local, domain] = String(box).split("@");
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (domain !== "gmail.com") return new RegExp(`^${escape(local)}(\\+[^@]*)?@${escape(domain)}$`, "i");
  return new RegExp(`^${local.split("").map(escape).join("\\.?")}(\\+[^@]*)?@(gmail|googlemail)\\.com$`, "i");
}

const distance = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
};

const suggestionFor = (email) => {
  const [local, domain] = String(email || "").trim().toLowerCase().split("@");
  if (!local || !domain || POPULAR.includes(domain)) return null;
  const near = POPULAR.find((p) => distance(domain, p) <= 2);
  return near ? `${local}@${near}` : null;
};

const mxCache = new Map();

// tests sign up with made-up domains, so only a test that asks for the lookup gets it
const lookupsOn = () => process.env.NODE_ENV !== "test" || process.env.EMAIL_DNS_CHECK === "1";

// false only when the domain says it takes no mail. a lookup that times out or errors lets the address through:
// a dns hiccup must never stop a real person signing up.
async function acceptsMail(domain) {
  if (!lookupsOn()) return true;
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.at < MX_TTL_MS) return cached.ok;
  let ok = true;
  let timer;
  try {
    const records = await Promise.race([
      dns.promises.resolveMx(domain),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), DNS_TIMEOUT_MS);
      }),
    ]);
    // a lone record with an empty host is the explicit "this domain takes no mail" (rfc 7505)
    ok = records.some((r) => r.exchange && r.exchange !== ".");
  } catch (err) {
    ok = !["ENOTFOUND", "ENODATA", "ENONAME"].includes(err && err.code);
  } finally {
    clearTimeout(timer);
  }
  mxCache.set(domain, { ok, at: Date.now() });
  return ok;
}

// why an address cannot be signed up with, or null. the suggestion fixes a likely typo.
async function signupProblem(email) {
  const domain = domainOf(email);
  if (!domain) return { reason: "invalid" };
  if (await acceptsMail(domain)) return null;
  return { reason: "noMailServer", suggestion: suggestionFor(email) };
}

// the stricter check for the address that proves an account: it has to take mail and not be a throwaway inbox
async function verifyProblem(email) {
  const domain = domainOf(email);
  if (!domain) return { reason: "invalid" };
  if (DISPOSABLE.has(domain)) return { reason: "disposable" };
  if (!(await acceptsMail(domain))) return { reason: "noMailServer", suggestion: suggestionFor(email) };
  return null;
}

module.exports = { mailbox, mailboxPattern, domainOf, signupProblem, verifyProblem, suggestionFor, isDisposable: (d) => DISPOSABLE.has(String(d).toLowerCase()) };
