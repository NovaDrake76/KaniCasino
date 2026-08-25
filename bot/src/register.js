require("dotenv").config();

const { REST, Routes } = require("discord.js");
const { commands } = require("./commands");

// run after changing a command's name, description or options: discord caches the
// definitions. an argument scopes it to one guild, which lands instantly instead of hourly.
const guildId = process.argv[2];

(async () => {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token || !clientId) {
    console.error("register: DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are both required");
    process.exit(1);
  }

  const rest = new REST().setToken(token);
  const body = commands.map((command) => command.data.toJSON());
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  const done = await rest.put(route, { body });
  console.log(`register: ${done.length} commands ${guildId ? `in ${guildId}` : "globally"}`);
})().catch((err) => {
  console.error("register:", err.message);
  process.exit(1);
});
