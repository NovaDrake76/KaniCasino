const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require("discord.js");
const api = require("./api");
const { showcaseEmbed, topFanEmbed, leaderboardEmbed, linkEmbed, noticeEmbed, SITE } = require("./embeds");
const { spinningFrame, revealFrame, demoFrame, FRAMES, FRAME_MS } = require("./spin");

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const V2 = { flags: MessageFlags.IsComponentsV2 };

// the components v2 flag cannot be added to a message that was made without it, so the
// first frame is the reply itself rather than a deferral. it costs nothing to draw and
// buys the whole three second window for the call behind it.
const OPENING = () =>
  new ContainerBuilder()
    .setAccentColor(0x4a4a5a)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("Opening…"));

// shared by the command and by the "open another" button, which is the quickest way to
// open the same case again and the reason the command only has to be typed once
async function runOpen(interaction, caseId, quantity) {
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ components: [OPENING()], ...V2 });
  }

  let opened = null;
  let demo = null;
  try {
    opened = await api.openCase(interaction.user.id, interaction.id, caseId, quantity);
  } catch (err) {
    // no account is not a refusal here: it is the whole pitch. spin it anyway, keep
    // nothing, and say so. any other 404 is a real one and belongs to the caller.
    if (err.status === 404 && err.data.notLinked) demo = await api.preview(caseId);
    else throw err;
  }

  const caseTitle = opened ? opened.case.title : demo.case.title;
  const names = (opened ? opened.reel : demo.reel) || [];

  for (let frame = 0; frame < FRAMES; frame += 1) {
    await interaction.editReply({ components: [spinningFrame(caseTitle, names, frame)], ...V2 });
    await sleep(FRAME_MS);
  }

  if (demo) {
    await interaction.editReply({ components: [demoFrame({ item: demo.item, caseTitle })], ...V2 });
    return;
  }

  // one card, carrying the rarest of the pull, the way the site's own feed does it
  const best = opened.items.reduce((a, b) => (Number(b.rarity) > Number(a.rarity) ? b : a));
  await interaction.editReply({
    components: [
      revealFrame({
        item: best,
        caseTitle,
        caseId: opened.case.id,
        ownerId: interaction.user.id,
        balance: opened.walletBalance,
        fanRank: opened.fanRank,
        others: opened.items.length - 1,
      }),
    ],
    ...V2,
  });
}

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
      .setName("open")
      .setDescription("Open a case")
      .addStringOption((option) =>
        option
          .setName("case")
          .setDescription("Which case. Start typing, or pick the one you opened last.")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption((option) =>
        option.setName("quantity").setDescription("How many, up to 5").setMinValue(1).setMaxValue(5)
      ),
    // 64 cases is well past discord's 25 choice cap, so the list is filtered server side.
    // an empty box leads with whatever this player opened last.
    async autocomplete(interaction) {
      const typed = interaction.options.getFocused();
      const { cases } = await api.cases(typed, interaction.user.id);
      await interaction.respond(
        cases.map((one) => ({ name: `${one.title}  ·  K₽ ${one.price.toLocaleString("en-US")}`.slice(0, 100), value: String(one.id) }))
      );
    },
    async run(interaction) {
      await runOpen(interaction, interaction.options.getString("case"), interaction.options.getInteger("quantity") || 1);
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

module.exports = { commands, onCooldown, runOpen };
