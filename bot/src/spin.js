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
// while it is still spinning nothing has been decided, so the frame wears no rarity
const SPINNING = 0x4a4a5a;

// discord renders a small ansi palette inside a code block, and it is the only way to get
// colour into the reel. as near the site's five as eight colours allow, so a gold name
// walking toward the marker reads the way a gold reads on the site. a client that does not
// render ansi shows the plain name, which is what it showed before.
// bold everywhere it is not already, because bold is the form discord has been seen to
// render. a common came out plain white: it asked for bare "34" and got nothing, while
// "31", "1;33" and "1;35" all painted correctly on the same line. the reels of these cases
// hold nothing under rarity 3, so bare "34" and "35" had never actually been drawn before.
//
// cyan for rare rather than the site's purple: ansi has no purple, and pink is spent on
// epic, so telling one from the other matters more here than matching the hex.
const ANSI = { "1": "1;34", "2": "1;36", "3": "1;35", "4": "31", "5": "1;33" };
const ESC = String.fromCharCode(27);
const paint = (text, rarity) => `${ESC}[${ANSI[String(rarity)] || "37"}m${text}${ESC}[0m`;

const colorOf = (rarity) => RARITY_COLOR[String(rarity)] || SPINNING;
const nameOf = (rarity) => RARITY_NAME[String(rarity)] || "";
// values can carry fractions, and "K₽ 77,671.455" reads as a typo rather than a number
const num = (value) => Math.round(Number(value) || 0).toLocaleString("en-US");

// how many names are visible at once, and which of them sits under the marker
const WINDOW = 5;
const MIDDLE = 2;
// how many times the reel is redrawn, and how long each is held. every redraw is a call to
// discord and none to the site: the outcome was decided before the first frame, exactly as
// the reel on the site animates toward an answer it already has.
const FRAMES = 3;
const FRAME_MS = 550;

// the offset is the frame number, so the cell that ends up under the marker on the last
// frame is this one, and seating the prize there is what makes the reel continuous: it
// sits at the far right on the first frame, walks one place in on the second, and arrives
// on the third.
//
// the first version drew each frame as its own window into a shuffled list, so the names
// to the right of the marker were not what came next. a player reads those as what is
// about to land, and it was not, which is exactly why it read as fake.
const LANDING = FRAMES - 1 + MIDDLE;

const clip = (name) => (name.length > 28 ? `${name.slice(0, 27)}…` : name);
// the reel used to be plain names; entries carry a rarity now, and both still work
const entryOf = (value) =>
  typeof value === "string" ? { name: value, rarity: null } : { name: value.name, rarity: value.rarity };

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// one continuous strip per opening, long enough for every frame's window, shuffled so two
// openings of a case do not scroll the same order, with the prize seated where it lands
function buildStrip(pool, winner) {
  const won = entryOf(winner || { name: "?", rarity: null });
  const items = (pool || []).map(entryOf).filter((entry) => entry && entry.name);
  const needed = FRAMES - 1 + WINDOW;

  const strip = [];
  while (strip.length < needed) strip.push(...shuffled(items.length ? items : [won]));
  strip.length = needed;
  strip[LANDING] = won;
  return strip;
}

// one colour span per line, and no more.
//
// the first version drew the five names across a single line, which needed ten escape
// sequences in ninety characters, and discord's highlighter silently dropped two of them:
// the payload asked for red and pink, the client painted grey. the codes were identical to
// the ones it rendered correctly two cells earlier, so it is a limit in their parser and
// nothing that can be fixed from this side, only avoided.
//
// stacked, each line carries exactly one set and one reset. it also stops truncating names
// at twelve characters, and the prize now climbs toward the marker rather than sliding.
function reelRow(strip, offset) {
  const pool = strip && strip.length ? strip.map(entryOf) : [{ name: "?", rarity: null }];
  const lines = [];
  for (let i = 0; i < WINDOW; i += 1) {
    const entry = pool[(offset + i) % pool.length];
    const marker = i === MIDDLE ? "▸ " : "  ";
    lines.push(paint(`${marker}${clip(entry.name)}`, entry.rarity));
  }
  return ["```ansi", ...lines, "```"].join("\n");
}

function spinningFrame(caseTitle, strip, offset, landed, rarity) {
  return new ContainerBuilder()
    .setAccentColor(landed ? colorOf(rarity) : SPINNING)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Opening **${caseTitle}**`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(reelRow(strip, offset)));
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

module.exports = {
  reelRow,
  buildStrip,
  spinningFrame,
  revealFrame,
  demoFrame,
  FRAMES,
  FRAME_MS,
  LANDING,
  WINDOW,
  MIDDLE,
  colorOf,
  nameOf,
  SITE,
};
