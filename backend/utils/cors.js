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

module.exports = { parseOrigins, originAllowed };
