const BASE = (process.env.API_BASE_URL || "http://127.0.0.1:5001").replace(/\/$/, "");

// every call carries both keys: the site key, because the whole api sits behind it, and
// the bot secret, because the site key ships in the frontend bundle and guards nothing.
const headers = () => ({
  "Content-Type": "application/json",
  "x-api-key": process.env.API_KEY || "",
  "x-bot-secret": process.env.DISCORD_BOT_SECRET || "",
});

// the backend is on the same box, so a slow call means it is in trouble rather than far away
const TIMEOUT_MS = 8000;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function call(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new ApiError(res.status, data.message || "Request failed");
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw new ApiError(504, "The site did not answer in time");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const get = (path) => call("GET", path);
const post = (path, body) => call("POST", path, body);

module.exports = {
  ApiError,
  linkStart: (discordId, discordName) => post("/discord/link/start", { discordId, discordName }),
  showcase: (discordId) => get(`/discord/showcase/${encodeURIComponent(discordId)}`),
  topFan: (name, guildId) =>
    get(`/discord/topfan/${encodeURIComponent(name)}?guild=${encodeURIComponent(guildId)}`),
  leaderboard: (guildId, sort) =>
    get(`/discord/leaderboard?guild=${encodeURIComponent(guildId)}&sort=${encodeURIComponent(sort)}`),
  // fired and forgotten: being on a server board is not worth failing a command over
  seen: (discordId, guildId) =>
    post("/discord/seen", { discordId, guildId }).catch(() => {}),

  cases: (query, discordId) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (discordId) params.set("discordId", discordId);
    const suffix = params.toString();
    return get("/discord/cases" + (suffix ? `?${suffix}` : ""));
  },
  preview: (caseId) => get(`/discord/preview/${encodeURIComponent(caseId)}`),
  // the interaction id is what stops one command charging twice if the gateway replays it
  openCase: (discordId, interactionId, caseId, quantity) =>
    post("/discord/open", { discordId, interactionId, caseId, quantity }),
};
