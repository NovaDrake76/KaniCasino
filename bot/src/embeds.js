const { EmbedBuilder } = require("discord.js");

const SITE = (process.env.SITE_URL || "https://kanicasino.com").replace(/\/$/, "");
// the domain, derived rather than typed, so a staging SITE_URL never signs itself as
// production. every message the bot sends carries it: a link button with no visible
// destination is what makes a bot look like a scam.
const HOST = SITE.replace(/^https?:\/\//, "");

// the same five the site paints items with, so a card in discord reads as the same object
const RARITY = {
  "1": 0x4b69ff,
  "2": 0x8847ff,
  "3": 0xd32ce6,
  "4": 0xeb4b4b,
  "5": 0xffff6e,
};
const NEUTRAL = 0xf0287a;

const colorOf = (rarity) => RARITY[String(rarity)] || NEUTRAL;
const num = (value) => Number(value || 0).toLocaleString("en-US");
const medal = (index) => ["1.", "2.", "3."][index] || `${index + 1}.`;

// the slug when the account has one, the id otherwise: both resolve, one reads better
const profileUrl = (card) => `${SITE}/profile/${card.slug || card.userId}`;
const boardUrl = (name) => `${SITE}/fandom/${encodeURIComponent(name)}`;

function showcaseEmbed(card) {
  const embed = new EmbedBuilder()
    .setColor(colorOf(card.pinned && card.pinned.rarity))
    .setTitle(card.username)
    .setURL(profileUrl(card))
    .setFooter({ text: HOST });

  if (card.profilePicture) embed.setThumbnail(card.profilePicture);

  const lines = [`Level ${num(card.level)}`];
  if (card.badge && card.badge.label) lines.push(card.badge.label);
  embed.setDescription(lines.join("  ·  "));

  if (card.pinned) {
    const worn = card.pinned.variant ? `${card.pinned.name} (${card.pinned.variant})` : card.pinned.name;
    embed.addFields({ name: "Pinned", value: `[${worn}](${boardUrl(card.pinned.name)})`, inline: true });
    if (card.pinned.image) embed.setImage(card.pinned.image);
  }

  if (card.fanRank) {
    const standing =
      card.fanRank.rank === 1
        ? `**#1** of ${num(card.fanRank.fans)} fans`
        : `#${card.fanRank.rank} of ${num(card.fanRank.fans)} fans`;
    embed.addFields({
      name: "Fan rank",
      value: `${standing}\n${num(card.fanRank.count)} copies`,
      inline: true,
    });
  }

  if (card.collection && card.collection.distinct) {
    embed.addFields({
      name: "Collection",
      value: `${num(card.collection.distinct)} characters\n${num(card.collection.total)} items`,
      inline: true,
    });
  }

  return embed;
}

function topFanEmbed(board, guildName) {
  const embed = new EmbedBuilder()
    .setColor(colorOf(board.rarity))
    .setTitle(`Top ${board.name} fan in ${guildName}`)
    .setURL(boardUrl(board.name))
    .setFooter({ text: HOST });

  if (board.image) embed.setThumbnail(board.image);

  if (!board.ranks.length) {
    embed.setDescription(
      `Nobody here has pinned **${board.name}** yet. The board is open.
[Take it](${boardUrl(board.name)}), and run \`/link\` first if you have not linked yet.`
    );
    return embed;
  }

  embed.setDescription(
    board.ranks
      .map((row, index) => `${medal(index)} **${row.username}** — ${num(row.count)}`)
      .join("\n")
  );
  // the server's leader is rarely the site's, and the gap is the reason to keep opening
  embed.addFields({
    name: "Worldwide leader",
    value: `${num(board.global)} copies, across ${num(board.fanCount)} fans`,
  });
  return embed;
}

function leaderboardEmbed(payload, guildName) {
  const byCollection = payload.sort === "collection";
  const embed = new EmbedBuilder()
    .setColor(NEUTRAL)
    .setTitle(byCollection ? `Biggest collections in ${guildName}` : `Highest levels in ${guildName}`)
    .setURL(SITE)
    .setFooter({ text: HOST });

  if (!payload.players.length) {
    embed.setDescription("Nobody here has linked an account yet. Run `/link` to be the first.");
    return embed;
  }

  embed.setDescription(
    payload.players
      .map((card, index) => {
        const stat = byCollection
          ? `${num(card.collection && card.collection.distinct)} characters`
          : `level ${num(card.level)}`;
        const pin = card.pinned ? ` · ${card.pinned.name}` : "";
        return `${medal(index)} **${card.username}** — ${stat}${pin}`;
      })
      .join("\n")
  );
  return embed;
}

function linkEmbed(link) {
  return new EmbedBuilder()
    .setColor(NEUTRAL)
    .setTitle("Link your KaniCasino account")
    .setDescription(
      [
        "Open this link while logged in on the site, and your Discord account is attached:",
        `**[Link my account](${link.url})**`,
        "",
        "Only you can see this message, and the link works for 15 minutes.",
        "No account yet? Sign up on that page first, then the same link finishes the job.",
      ].join("\n")
    )
    .setFooter({ text: HOST });
}

const noticeEmbed = (text) =>
  new EmbedBuilder().setColor(NEUTRAL).setDescription(text).setFooter({ text: HOST });

module.exports = { showcaseEmbed, topFanEmbed, leaderboardEmbed, linkEmbed, noticeEmbed, SITE, HOST };
