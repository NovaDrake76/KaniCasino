const api = require("./api");

// membership of the home server is what the site pays the daily gift's discord boost on.
// the site can never ask discord mid-spin, so the bot pushes the answer instead: one write
// per join or leave, and a full list at boot to heal anything missed while it was down.
const HOME_GUILD_ID = process.env.DISCORD_GUILD_ID || "";

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
  if (!HOME_GUILD_ID) return { skipped: true };
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

module.exports = { HOME_GUILD_ID, isHome, pushOne, syncAll };
