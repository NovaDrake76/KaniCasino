// two thirds of the catalog is hosted on steam's cdn, which sends no cors header, so a
// canvas that drew it could never be exported. our own bucket carries a policy and does.
const HOSTS = new Set([
  "kanicases.s3.amazonaws.com",
  "kanicases.s3.us-east-1.amazonaws.com",
  "community.akamai.steamstatic.com",
  "community.cloudflare.steamstatic.com",
  "steamcommunity-a.akamaihd.net",
]);

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const CACHE_SECONDS = 31536000;

// an allowlist, not a blocklist: without one this endpoint fetches anything the box can
// reach on a caller's behalf, the internal network included.
function allow(raw) {
  if (typeof raw !== "string" || !raw || raw.length > 2048) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!HOSTS.has(url.host)) return null;
  return url.toString();
}

const tooBig = (length) => {
  const size = Number(length);
  return Number.isFinite(size) && size > MAX_BYTES;
};

module.exports = { HOSTS, MAX_BYTES, TIMEOUT_MS, CACHE_SECONDS, allow, tooBig };
