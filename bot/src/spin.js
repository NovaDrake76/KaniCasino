const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const SITE = (process.env.SITE_URL || "https://kanicasino.com").replace(/\/$/, "");

// the five the site paints items with, so a colour means the same thing in both places
const RARITY_COLOR = { "1": 0x4b69ff, "2": 0x8847ff, "3": 0xd32ce6, "4": 0xeb4b4b, "5": 0xffff6e };
const RARITY_NAME = { "1": "Common", "2": "Rare", "3": "Epic", "4": "Ultra Rare", "5": "Unique" };
// while it is still spinning nothing has been decided, so it wears no rarity
const SPINNING = 0x4a4a5a;

const colorOf = (rarity) => RARITY_COLOR[String(rarity)] || SPINNING;
const nameOf = (rarity) => RARITY_NAME[String(rarity)] || "";
// values can carry fractions, and "K₽ 77,671.455" reads as a typo rather than a number
const num = (value) => Math.round(Number(value) || 0).toLocaleString("en-US");

// how many names are visible at once, and which of them sits under the marker
const WINDOW = 5;
const MIDDLE = 2;

// a row of names that shifts one place per frame while the marker stays put, which is
// what reads as movement in a message that can only be redrawn a few times
function reelRow(names, offset, landed) {
  const pool = names && names.length ? names : ["?"];
  const shown = [];
  for (let i = 0; i < WINDOW; i += 1) {
    const name = pool[(offset + i) % pool.length];
    shown.push(name.length > 12 ? `${name.slice(0, 11)}…` : name);
  }
  if (landed) shown[MIDDLE] = landed.length > 12 ? `${landed.slice(0, 11)}…` : landed;
  return "```\n" + shown.map((name, i) => (i === MIDDLE ? `▐ ${name} ▌` : ` ${name} `)).join("│") + "\n```";
}

// how many times the reel is redrawn before it stops, and how long each is held. every
// redraw is a call to discord and none to the site: the outcome was decided before the
// first frame, exactly as the reel on the site is animated to an answer it already has.
const FRAMES = 3;
const FRAME_MS = 550;

// a strip built fresh for each spin, so two openings of one case do not scroll the same
// five names past in the same order, and so the item actually won is on it
function buildStrip(names, winner) {
  const pool = (names || []).filter(Boolean);
  const strip = [...pool];
  for (let i = strip.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [strip[i], strip[j]] = [strip[j], strip[i]];
  }
  // a reel the prize is not on is the thing that reads as fake
  if (winner && !strip.includes(winner)) strip.push(winner);
  while (strip.length < WINDOW + 2) strip.push(...(strip.length ? strip : ["?"]));
  return strip;
}

// the last frame is the landing: the item actually won sits under the marker wearing its
// own colour, so the reel arrives somewhere instead of being replaced mid-spin
function spinningFrame(caseTitle, names, offset, landed, rarity) {
  return new ContainerBuilder()
    .setAccentColor(landed ? colorOf(rarity) : SPINNING)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Opening **${caseTitle}**`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(reelRow(names, offset, landed)));
}

const buttons = (...rows) => new ActionRowBuilder().addComponents(...rows.filter(Boolean));

// a section is only valid with an accessory, so an item carrying no art gets a plain
// heading. building it the other way throws, and discord does not say so until a player
// pulls the one item in the catalogue that has no picture.
const isArt = (url) => typeof url === "string" && /^https?:\/\//.test(url);

function addHeading(container, item, caseTitle) {
  const content = `### ${item.name}\n${nameOf(item.rarity)} · ${caseTitle}`;
  if (isArt(item.image)) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(item.image))
    );
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  }
  return container;
}

function revealFrame({ item, caseTitle, caseId, ownerId, fanRank }) {
  const container = new ContainerBuilder().setAccentColor(colorOf(item.rarity));

  addHeading(container, item, caseTitle);
  container.addSeparatorComponents(new SeparatorBuilder());

  const lines = [`Worth **K₽ ${num(item.value)}**`];
  if (fanRank) {
    lines.push(
      fanRank.rank === 1
        ? `You hold **${num(fanRank.count)} ${fanRank.name}**, still **#1** of ${num(fanRank.fans)} fans`
        : `You hold **${num(fanRank.count)} ${fanRank.name}**, **#${fanRank.rank}** of ${num(fanRank.fans)} fans`
    );
  }
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

  container.addActionRowComponents(
    buttons(
      new ButtonBuilder().setCustomId(`open:${caseId}:${ownerId}`).setLabel("Open another").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setLabel("Open it on the site").setStyle(ButtonStyle.Link).setURL(`${SITE}/case/${caseId}`)
    )
  );
  return container;
}

// the same reveal for somebody with no account, saying plainly that it was not kept
function demoFrame({ item, caseTitle }) {
  const container = new ContainerBuilder().setAccentColor(colorOf(item.rarity));

  addHeading(container, item, caseTitle);
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("This was a demo spin. Create an account to keep the next rolls.")
  );
  container.addActionRowComponents(
    buttons(new ButtonBuilder().setLabel("Create an account").setStyle(ButtonStyle.Link).setURL(SITE))
  );
  return container;
}

module.exports = { reelRow, buildStrip, spinningFrame, revealFrame, demoFrame, FRAMES, FRAME_MS, colorOf, nameOf, SITE };
