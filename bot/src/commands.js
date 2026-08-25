const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const api = require("./api");
const { showcaseEmbed, topFanEmbed, leaderboardEmbed, linkEmbed, noticeEmbed, SITE } = require("./embeds");

// rejected in the bot's own memory, before any http call. spamming a command costs a map
// lookup here rather than a query on a link that carries about 100 KB/s.
const COOLDOWN_MS = 5000;
const lastUsed = new Map();

function onCooldown(userId, name) {
  const key = `${userId}:${name}`;
  const now = Date.now();
  const previous = lastUsed.get(key) || 0;
  if (now - previous < COOLDOWN_MS) return Math.ceil((COOLDOWN_MS - (now - previous)) / 1000);
  lastUsed.set(key, now);
  return 0;
}

// the map would otherwise hold a row per user per command forever
setInterval(() => {
  const cutoff = Date.now() - COOLDOWN_MS * 4;
  for (const [key, at] of lastUsed) if (at < cutoff) lastUsed.delete(key);
}, 60000).unref();

// never state that an account is missing without saying how to get one: on its own that
// reads as a refusal, and somebody has to answer "so how do I link it?" by hand
const LINK_HINT = "Run `/link` to attach one, it takes about a minute.";
const NOT_LINKED = `You have not linked a KaniCasino account yet. ${LINK_HINT}`;
const theyAreNotLinked = (name) =>
  `**${name}** has not linked a KaniCasino account yet. They can attach one with \`/link\`.`;

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName("link")
      .setDescription("Attach your KaniCasino account to this Discord user"),
    async run(interaction) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const link = await api.linkStart(interaction.user.id, interaction.user.username);
      if (link.alreadyLinked) {
        await interaction.editReply({
          embeds: [
            noticeEmbed(
              `You are already linked to **${link.username}**. Change it from the settings tab on ${SITE}.`
            ),
          ],
        });
        return;
      }
      await interaction.editReply({ embeds: [linkEmbed(link)] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("showcase")
      .setDescription("Show a player's pinned character and standing")
      .addUserOption((option) =>
        option.setName("player").setDescription("Whose card to show. Defaults to you.")
      ),
    async run(interaction) {
      await interaction.deferReply();
      const target = interaction.options.getUser("player") || interaction.user;
      const card = await api.showcase(target.id);
      await interaction.editReply({ embeds: [showcaseEmbed(card)] });
    },
    notFound: (interaction) => {
      const target = interaction.options.getUser("player");
      return target ? theyAreNotLinked(target.username) : NOT_LINKED;
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("topfan")
      .setDescription("Who in this server collects a character hardest")
      .addStringOption((option) =>
        option.setName("character").setDescription("The character to rank").setRequired(true)
      ),
    async run(interaction) {
      await interaction.deferReply();
      const name = interaction.options.getString("character");
      const board = await api.topFan(name, interaction.guildId);
      await interaction.editReply({ embeds: [topFanEmbed(board, interaction.guild.name)] });
    },
    notFound: (interaction) =>
      `No character called **${interaction.options.getString("character")}**. Browse them at ${SITE}/fandom`,
  },
  {
    data: new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("The KaniCasino players in this server")
      .addStringOption((option) =>
        option
          .setName("sort")
          .setDescription("What to rank by")
          .addChoices(
            { name: "Level", value: "level" },
            { name: "Collection", value: "collection" }
          )
      ),
    async run(interaction) {
      await interaction.deferReply();
      const sort = interaction.options.getString("sort") || "level";
      const payload = await api.leaderboard(interaction.guildId, sort);
      await interaction.editReply({ embeds: [leaderboardEmbed(payload, interaction.guild.name)] });
    },
  },
  {
    data: new SlashCommandBuilder().setName("help").setDescription("What this bot is"),
    async run(interaction) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          noticeEmbed(
            [
              `**KaniCasino** is a fake-coin casino where you open cases, collect characters and fight for their fan boards.`,
              "",
              "`/link` attach your account, once",
              "`/showcase` your pinned character and standing",
              "`/topfan` who in this server collects a character hardest",
              "`/leaderboard` the players in this server",
              "",
              `Everything else, and every case, is at ${SITE}`,
            ].join("\n")
          ),
        ],
      });
    },
  },
];

module.exports = { commands, onCooldown };
