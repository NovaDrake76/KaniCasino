const api = require("./api");

// membership of the home server is what the site pays the daily gift's discord boost on.
// the site can never ask discord mid-spin, so the bot pushes the answer instead: one write
// per join or leave, and a full list at boot to heal anything missed while it was down.
const HOME_GUILD_ID = process.env.DISCORD_GUILD_ID || "";

// GuildMembers is privileged, and discord refuses the login outright when it is requested
// without being enabled in the developer portal: "Used disallowed intents", and the bot is
// simply down. tying that to DISCORD_GUILD_ID made setting one config value able to take
// the whole bot offline, which is what happened. the intent needs its own opt-in, set only
// after the portal toggle is on.
const WANTS_MEMBER_INTENT =
  !!HOME_GUILD_ID && process.env.DISCORD_MEMBER_INTENT === "true";

const isHome = (guildId) => !!HOME_GUILD_ID && String(guildId) === HOME_GUILD_ID;

async function pushOne(discordId, guildId, present) {
  if (!isHome(guildId)) return;
  try {
    await api.membership(String(discordId), String(guildId), present);
  } catch (err) {
    console.error("bot membership:", err.message);
  }
}

// discord pages this at 1000 a request, so a server of any size this bot will see is a
// handful of calls at startup and none after
async function syncAll(client) {
  // without the intent there is no member list to read, so there is nothing to sync
  if (!WANTS_MEMBER_INTENT) return { skipped: true };
  try {
    const guild = await client.guilds.fetch(HOME_GUILD_ID);
    const members = await guild.members.fetch();
    const ids = [...members.keys()].map(String);
    const result = await api.syncMembers(HOME_GUILD_ID, ids);
    console.log(`bot: synced ${ids.length} members of the home server`);
    return result;
  } catch (err) {
    console.error("bot member sync:", err.message);
    return { failed: true };
  }
}

module.exports = { HOME_GUILD_ID, WANTS_MEMBER_INTENT, isHome, pushOne, syncAll };
