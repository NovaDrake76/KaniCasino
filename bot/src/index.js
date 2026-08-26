require("dotenv").config();

const { Client, Events, GatewayIntentBits, MessageFlags } = require("discord.js");
const api = require("./api");
const { noticeEmbed } = require("./embeds");
const { commands, onCooldown, runOpen } = require("./commands");

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

// the box has three seconds to fill, and an empty list is a better answer than a spinner
// that never resolves, so a failure here is swallowed rather than logged loudly
async function suggest(interaction) {
  const command = byName.get(interaction.commandName);
  if (!command || !command.autocomplete) return;
  try {
    await command.autocomplete(interaction);
  } catch (err) {
    await interaction.respond([]).catch(() => {});
  }
}

// "open another" on somebody else's reveal would charge the clicker for a case they did
// not choose, so the owner rides in the custom id and only they can press it
async function pressed(interaction) {
  const [action, caseId, ownerId] = interaction.customId.split(":");
  if (action !== "open") return;
  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      embeds: [noticeEmbed("That one is not yours. Run `/open` and it will be.")],
      flags: MessageFlags.Ephemeral,
    });
  }
  const wait = onCooldown(interaction.user.id, "open");
  if (wait) {
    return interaction.reply({
      embeds: [noticeEmbed(`Give it ${wait}s.`)],
      flags: MessageFlags.Ephemeral,
    });
  }
  await runOpen(interaction, caseId, 1);
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) return await suggest(interaction);
    if (interaction.isButton()) return await pressed(interaction);
  } catch (err) {
    console.error("bot interaction:", err.message);
    return reply(interaction, "The site did not answer. Try again in a moment.");
  }

  if (!interaction.isChatInputCommand()) return;
  const command = byName.get(interaction.commandName);
  if (!command) return;

  if (!interaction.guildId && interaction.commandName !== "link") {
    return reply(interaction, "That one only works inside a server. Try it in a channel there.");
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
