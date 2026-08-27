const crypto = require("node:crypto");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} = require("discord.js");
const { SITE, colorOf } = require("./spin");

// discord's own ceiling on a select, and the same number the backend pages by
const PER_PAGE = 25;
const NO_CATEGORY = "~none";
const ACCENT = 0xf0287a;

const num = (value) => Number(value || 0).toLocaleString("en-US");
const label = (name) => (name === NO_CATEGORY ? "Other" : name);

// a category name is free text with no length limit and a custom id has a hard 100
// character one, so the id carries a digest of the name and a click resolves it back
// against the shelf list. the name itself only ever travels as a select value.
const tokenOf = (name) => crypto.createHash("sha1").update(String(name || "")).digest("hex").slice(0, 10);

const ID = {
  category: "menu|cat",
  cases: (category, offset) => `menu|case|${tokenOf(category)}|${offset}`,
  page: (category, offset) => `menu|page|${tokenOf(category)}|${offset}`,
  back: "menu|back",
};

// every menu id starts here, so index.js can route the whole family on one prefix
const isMenu = (customId) => String(customId || "").startsWith("menu|");

function parseMenu(customId) {
  const [, kind, token, offset] = String(customId || "").split("|");
  return { kind, token: token || "", offset: Math.max(0, parseInt(offset, 10) || 0) };
}

const row = (component) => new ActionRowBuilder().addComponents(component);

function categoryFrame(categories) {
  const container = new ContainerBuilder()
    .setAccentColor(ACCENT)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### Open a case"))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Pick a series, then pick a case. No command to remember.")
    )
    .addSeparatorComponents(new SeparatorBuilder());

  if (!categories.length) {
    return container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("No cases are open in Discord right now.")
    );
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(ID.category)
    .setPlaceholder("Choose a series")
    .addOptions(
      categories.slice(0, PER_PAGE).map((one) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(label(one.name).slice(0, 100))
          .setValue(String(one.name).slice(0, 100))
          .setDescription(`${num(one.count)} cases · from K₽ ${num(one.from)}`.slice(0, 100))
      )
    );

  return container.addActionRowComponents(row(select));
}

function caseFrame({ category, cases, total, offset }) {
  const first = offset + 1;
  const last = offset + cases.length;
  const paged = total > cases.length;

  const container = new ContainerBuilder()
    .setAccentColor(ACCENT)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${label(category)}`))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        paged ? `${num(total)} cases · showing ${num(first)}-${num(last)}` : `${num(total)} cases`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder());

  if (!cases.length) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Nothing on this shelf opens in Discord.")
    );
  } else {
    const select = new StringSelectMenuBuilder()
      .setCustomId(ID.cases(category, offset))
      .setPlaceholder("Choose a case")
      .addOptions(
        cases.map((one) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(String(one.title).slice(0, 100))
            .setValue(String(one.id).slice(0, 100))
            .setDescription(`K₽ ${num(one.price)}`.slice(0, 100))
        )
      );
    container.addActionRowComponents(row(select));
  }

  const controls = [
    new ButtonBuilder().setCustomId(ID.back).setLabel("Series").setStyle(ButtonStyle.Secondary),
  ];
  if (offset > 0) {
    controls.push(
      new ButtonBuilder()
        .setCustomId(ID.page(category, Math.max(0, offset - PER_PAGE)))
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
    );
  }
  if (last < total) {
    controls.push(
      new ButtonBuilder()
        .setCustomId(ID.page(category, offset + PER_PAGE))
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
    );
  }
  controls.push(new ButtonBuilder().setLabel("See them on the site").setStyle(ButtonStyle.Link).setURL(SITE));

  return container.addActionRowComponents(new ActionRowBuilder().addComponents(...controls));
}

// what the menu turns into once a case has been picked: the spin is its own message, so
// leaving the select live would let a stray second pick charge for a case nobody chose
function chosenFrame(title) {
  return new ContainerBuilder()
    .setAccentColor(colorOf(null))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Opening **${title}** below.`));
}

module.exports = {
  ID,
  tokenOf,
  PER_PAGE,
  NO_CATEGORY,
  isMenu,
  parseMenu,
  categoryFrame,
  caseFrame,
  chosenFrame,
  label,
};
