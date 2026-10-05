const crypto = require("crypto");
const IpSighting = require("../models/IpSighting");

// one write per account and address every few hours is enough to tell who shares a connection
const REFRESH_MS = 6 * 60 * 60 * 1000;
const MAX_REMEMBERED = 20000;
const recent = new Map();

// cloudflare sets this and the tunnel means a client cannot forge it; req.ip is only ever localhost here
const clientIp = (req) => req.headers["cf-connecting-ip"] || req.ip || "";

// keyed with the server secret, so the stored value cannot be turned back into an address by trying all of them
const hashIp = (ip) =>
  crypto
    .createHmac("sha256", crypto.createHmac("sha256", process.env.JWT_SECRET || "").update("ip-sighting").digest())
    .update(String(ip).trim())
    .digest("base64url")
    .slice(0, 22);

// notes that this account was seen on this request's address. never throws and never makes the request wait.
function record(req, userId) {
  try {
    const ip = clientIp(req);
    if (!ip || !userId) return;
    const ipHash = hashIp(ip);
    const key = `${userId}|${ipHash}`;
    const now = Date.now();
    if (now - (recent.get(key) || 0) < REFRESH_MS) return;
    recent.set(key, now);
    if (recent.size > MAX_REMEMBERED) recent.delete(recent.keys().next().value);
    IpSighting.updateOne(
      { userId, ipHash },
      { $setOnInsert: { firstAt: new Date(now) }, $set: { lastAt: new Date(now) } },
      { upsert: true }
    ).catch((err) => {
      if (err && err.code !== 11000) console.error("ip sighting:", err.message);
    });
  } catch (err) {
    console.error("ip sighting:", err.message);
  }
}

// the hash of the address a request came from, or null when it carries none
const requestHash = (req) => {
  const ip = clientIp(req);
  return ip ? hashIp(ip) : null;
};

const forget = () => recent.clear();

module.exports = { record, hashIp, clientIp, requestHash, forget };
