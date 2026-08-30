require("dotenv").config();

const { Client, Events, GatewayIntentBits, MessageFlags } = require("discord.js");
const api = require("./api");
const { noticeEmbed } = require("./embeds");
const { commands, onCooldown, runOpen, seriesMenu, casesMenu, categoryFor } = require("./commands");
const { isMenu, parseMenu, chosenFrame } = require("./menu");
const membership = require("./membership");

const REQUIRED = ["DISCORD_BOT_TOKEN", "DISCORD_BOT_SECRET", "API_KEY"];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
  console.error("bot: missing env", missing.join(", "));
  process.exit(1);
}

// GuildMessages is here for the mention, which is the only way in that does not go through
// the slash picker. GuildMembers is privileged and is only asked for when a home server is
// configured, because the daily gift's discord boost has to be held on real membership.
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
if (membership.HOME_GUILD_ID) intents.push(GatewayIntentBits.GuildMembers);
const client = new Client({ intents });

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

// the menu charges whoever clicked, on the case they just picked themselves, so it needs
// no owner check: a second player using someone else's open menu spins on their own balance
async function navigated(interaction) {
  const { kind, token, offset } = parseMenu(interaction.customId);
  if (kind === "back") return interaction.update(await seriesMenu());
  if (kind === "cat") return interaction.update(await casesMenu(interaction.values[0], 0));
  if (kind === "page") {
    // the shelf can be renamed or emptied between the render and the click, and paging a
    // category that no longer exists should land somewhere real rather than on nothing
    const category = await categoryFor(token);
    return interaction.update(category ? await casesMenu(category, offset) : await seriesMenu());
  }
  if (kind !== "case") return;

  const wait = onCooldown(interaction.user.id, "open");
  if (wait) {
    return interaction.reply({
      embeds: [noticeEmbed(`Give it ${wait}s.`)],
      flags: MessageFlags.Ephemeral,
    });
  }
  // close the select first: the interaction has three seconds and the spin takes longer,
  // and a live select under a running spin is a second charge waiting to happen
  const chosen = interaction.component.options.find((one) => one.value === interaction.values[0]);
  await interaction.update({
    components: [chosenFrame(chosen ? chosen.label : "it")],
    flags: MessageFlags.IsComponentsV2,
  });
  await runOpen(interaction, interaction.values[0], { channel: interaction.channel });
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
  await runOpen(interaction, caseId);
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) return await suggest(interaction);
    if (isMenu(interaction.customId)) return await navigated(interaction);
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

// the way in for a player who does not know the commands exist: they type the bot's name,
// which is the one thing everybody already knows how to do. a bare mention is enough, so
// the message content stays unread and the privileged intent stays unrequested.
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guildId) return;
  if (!message.mentions.has(client.user, { ignoreEveryone: true, ignoreRoles: true, ignoreRepliedUser: true })) return;

  const wait = onCooldown(message.author.id, "menu");
  if (wait) return;

  try {
    await api.seen(message.author.id, message.guildId);
    await message.reply(await seriesMenu());
  } catch (err) {
    console.error("bot mention:", err.message);
    await message.reply({ embeds: [noticeEmbed("The site did not answer. Try again in a moment.")] }).catch(() => {});
  }
});

// the boost has to come off the moment someone leaves, or it is a one-time click again
client.on(Events.GuildMemberAdd, (member) => membership.pushOne(member.id, member.guild.id, true));
client.on(Events.GuildMemberRemove, (member) => membership.pushOne(member.id, member.guild.id, false));

client.once(Events.ClientReady, async (ready) => {
  console.log(`bot: online as ${ready.user.tag} in ${ready.guilds.cache.size} servers`);
  await membership.syncAll(ready);
});

client.on(Events.Error, (err) => console.error("bot client:", err.message));
process.on("unhandledRejection", (err) => console.error("bot unhandled:", err && err.message));

client.login(process.env.DISCORD_BOT_TOKEN);
