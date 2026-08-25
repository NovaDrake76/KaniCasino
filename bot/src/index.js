require("dotenv").config();

const { Client, Events, GatewayIntentBits, MessageFlags } = require("discord.js");
const api = require("./api");
const { noticeEmbed } = require("./embeds");
const { commands, onCooldown } = require("./commands");

const REQUIRED = ["DISCORD_BOT_TOKEN", "DISCORD_BOT_SECRET", "API_KEY"];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
  console.error("bot: missing env", missing.join(", "));
  process.exit(1);
}

// Guilds is the only intent this needs. slash commands arrive as interactions, so nothing
// here reads messages or member lists, and no privileged intent has to be requested.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const byName = new Map(commands.map((command) => [command.data.name, command]));

const reply = async (interaction, text) => {
  const payload = { embeds: [noticeEmbed(text)], flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: payload.embeds }).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
};

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = byName.get(interaction.commandName);
  if (!command) return;

  if (!interaction.guildId && interaction.commandName !== "link") {
    return reply(interaction, "This one only works inside a server.");
  }

  const wait = onCooldown(interaction.user.id, interaction.commandName);
  if (wait) return reply(interaction, `Give it ${wait}s.`);

  try {
    // before the command, not after: otherwise a player's first /leaderboard in a server
    // is the one that does not list them. it no-ops for anyone who has not linked.
    if (interaction.guildId) await api.seen(interaction.user.id, interaction.guildId);
    await command.run(interaction);
  } catch (err) {
    if (err.status === 404 && command.notFound) return reply(interaction, command.notFound(interaction));
    if (err.status === 403 || err.status === 409) return reply(interaction, err.message);
    console.error(`bot ${interaction.commandName}:`, err.message);
    reply(interaction, "The site did not answer. Try again in a moment.");
  }
});

client.once(Events.ClientReady, (ready) => {
  console.log(`bot: online as ${ready.user.tag} in ${ready.guilds.cache.size} servers`);
});

client.on(Events.Error, (err) => console.error("bot client:", err.message));
process.on("unhandledRejection", (err) => console.error("bot unhandled:", err && err.message));

client.login(process.env.DISCORD_BOT_TOKEN);
