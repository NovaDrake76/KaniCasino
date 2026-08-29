// comma separated in the env, so a box can allow the apex and the www host at once
function parseOrigins(value, fallback = "https://kanicasino.com") {
  return String(value || fallback)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// a request with no Origin header is not a browser cross-origin call at all: curl, a
// server-to-server hit, the uptime probe, or the mail provider POSTing the one-click
// unsubscribe. cors does not apply to any of those, and refusing them would break every
// non-browser caller the moment NODE_ENV stops being development.
function originAllowed(origin, { isDevelopment = false, allowedOrigins = [] } = {}) {
  return isDevelopment || !origin || allowedOrigins.includes(origin);
}

// every authenticated call carries Authorization and x-api-key, which makes it a
// preflighted request. without a max-age the browser re-asks before each one, and chrome
// only caches for five seconds by default: an auto run paid a whole extra round trip per
// action, which for a player far from the box was most of the wait. 7200 is chrome's
// ceiling; firefox keeps it for a day.
const PREFLIGHT_MAX_AGE = 7200;

module.exports = { parseOrigins, originAllowed, PREFLIGHT_MAX_AGE };
