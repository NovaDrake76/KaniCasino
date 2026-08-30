// Every message that tells a player they have no linked account must also tell them how
// to get one.
//
//   npm test        (from bot/)
//
// Someone ran /showcase on a player who had not linked and got "X has not linked a
// KaniCasino account." full stop. That reads as a refusal, and a human had to answer
// "so use /link" by hand. The rule is cheap to keep and easy to forget, so it is checked
// against the source rather than trusted.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SOURCES = ["commands.js", "embeds.js", "index.js", "menu.js"];

// only the lines that state an account is missing. "Link your account" and "No account
// yet? Sign up first" are the instruction itself, and must not be caught by their own rule.
const STATES_AN_ABSENCE = /(have|has) not linked|nobody here has linked|no .{0,25}account is linked|is not linked/i;
// LINK_HINT counts: it is the instruction, just held in a constant so it stays identical
const OFFERS_THE_WAY = /\/link|settings tab|LINK_HINT/;

test("no message says an account is missing without saying how to link one", () => {
  const offenders = [];
  for (const file of SOURCES) {
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    source.split("\n").forEach((line, index) => {
      if (line.trim().startsWith("//")) return;
      if (!STATES_AN_ABSENCE.test(line)) return;
      if (OFFERS_THE_WAY.test(line)) return;
      // a template split across lines carries the instruction on the next one
      const next = source.split("\n")[index + 1] || "";
      if (OFFERS_THE_WAY.test(next)) return;
      offenders.push(`${file}:${index + 1}  ${line.trim()}`);
    });
  }
  assert.deepStrictEqual(offenders, [], "these tell a player they are not linked and stop there");
});

test("the showcase answers name the person who has to act", () => {
  process.env.SITE_URL = process.env.SITE_URL || "https://kanicasino.com";
  const { commands } = require("./commands");
  const showcase = commands.find((command) => command.data.name === "showcase");
  const asked = (username) => ({ options: { getUser: () => (username ? { username } : null) } });

  const aboutSomeoneElse = showcase.notFound(asked("solidddarling"));
  assert.match(aboutSomeoneElse, /solidddarling/);
  assert.match(aboutSomeoneElse, /They can/, "it is their account to link, not the caller's");
  assert.match(aboutSomeoneElse, /\/link/);

  const aboutYou = showcase.notFound(asked(null));
  assert.match(aboutYou, /^You have not/, "the caller is the one who has to act");
  assert.match(aboutYou, /\/link/);
});

// A player called the demo spin's bare "Create an account" button suspicious: nothing on
// the message said where the account would be, or who was asking. Every message the bot
// sends signs itself with the domain now, and the link buttons name it too.
test("every message the bot sends carries the site it came from", () => {
  process.env.SITE_URL = process.env.SITE_URL || "https://kanicasino.com";
  const embeds = require("./embeds");
  const spin = require("./spin");
  const menu = require("./menu");
  const host = embeds.HOST;

  const item = { name: "Sakuya", rarity: "5", value: 900, image: "https://x/y.png" };
  const card = { username: "someone", level: 3, userId: "u1" };

  const built = {
    "embeds.noticeEmbed": embeds.noticeEmbed("anything at all"),
    "embeds.showcaseEmbed": embeds.showcaseEmbed(card),
    "embeds.topFanEmbed": embeds.topFanEmbed({ name: "Sakuya", ranks: [] }, "a server"),
    "embeds.leaderboardEmbed": embeds.leaderboardEmbed({ players: [] }, "a server"),
    "embeds.linkEmbed": embeds.linkEmbed({ url: "https://x/link" }),
    "spin.spinningFrame": spin.spinningFrame("Nuclear", [{ name: "a", rarity: "1" }], 0, false, null),
    "spin.revealFrame": spin.revealFrame({ item, caseTitle: "Nuclear", caseId: "c1", ownerId: "u1" }),
    "spin.demoFrame": spin.demoFrame({ item, caseTitle: "Nuclear" }),
    "menu.categoryFrame": menu.categoryFrame([{ name: "Touhou", count: 2, from: 60 }]),
    "menu.categoryFrame (empty)": menu.categoryFrame([]),
    "menu.caseFrame": menu.caseFrame({
      category: "Touhou",
      cases: [{ id: "c1", title: "Nuclear", price: 60 }],
      total: 1,
      offset: 0,
    }),
    "menu.chosenFrame": menu.chosenFrame("Nuclear"),
  };

  const unsigned = Object.entries(built)
    .filter(([, message]) => !JSON.stringify(message.toJSON()).includes(host))
    .map(([name]) => name);

  assert.deepStrictEqual(unsigned, [], "these go out with nothing saying where they came from");
});

test("the demo spin says where the account would be, on the button as well", () => {
  process.env.SITE_URL = process.env.SITE_URL || "https://kanicasino.com";
  const { demoFrame, HOST } = require("./spin");
  const json = JSON.stringify(
    demoFrame({ item: { name: "Sakuya", rarity: "5", value: 900 }, caseTitle: "Nuclear" }).toJSON()
  );

  assert.ok(json.includes(`Create a free account on **${HOST}**`), "the copy names the site");
  // the label itself, because a link button showing only "Create an account" is the part
  // that reads as a scam
  assert.ok(json.includes(`"label":"Create an account on ${HOST}"`), "so does the button");
});

test("help lists the command the bot exists for", () => {
  process.env.SITE_URL = process.env.SITE_URL || "https://kanicasino.com";
  const { commands } = require("./commands");
  const names = commands.map((command) => command.data.name);

  // /open was missing from help entirely, which is the command the bot exists for
  const source = fs.readFileSync(path.join(__dirname, "commands.js"), "utf8");
  const help = source.slice(source.indexOf('setName("help")'));
  for (const name of names.filter((n) => n !== "help")) {
    assert.ok(help.includes(`\`/${name}\``), `/${name} is not in the help list`);
  }
});

// discord focuses the first option and opens its dropdown there, so the order of these
// two boxes is the whole feature: series first, then the cases on that shelf.
test("/open offers the series box before the case box", () => {
  process.env.SITE_URL = process.env.SITE_URL || "https://kanicasino.com";
  const { commands } = require("./commands");
  const open = commands.find((command) => command.data.name === "open");
  const options = open.data.toJSON().options || [];

  assert.deepStrictEqual(
    options.map((option) => option.name),
    ["series", "case"],
    "series has to come first, or discord opens the flat case list again"
  );
  assert.ok(options.every((option) => option.autocomplete), "both boxes suggest");
  assert.ok(options.every((option) => !option.required), "and neither is mandatory");
});

test("the case box only offers cases from the series already chosen", async () => {
  process.env.SITE_URL = process.env.SITE_URL || "https://kanicasino.com";
  const api = require("./api");
  const { commands } = require("./commands");
  const open = commands.find((command) => command.data.name === "open");

  const realCases = api.cases;
  const realCategories = api.categories;
  let askedFor = null;
  api.cases = async (query, discordId, page) => {
    askedFor = { query, page };
    return { cases: [{ id: "c1", title: "Nuclear Case", price: 60, category: "Touhou" }] };
  };
  api.categories = async () => ({ categories: [{ name: "Touhou", count: 3, from: 60 }] });

  const asked = (focusedName, focusedValue, series) => {
    const sent = [];
    return {
      sent,
      user: { id: "u1" },
      options: {
        getFocused: () => ({ name: focusedName, value: focusedValue }),
        getString: (name) => (name === "series" ? series : null),
      },
      respond: async (choices) => sent.push(choices),
    };
  };

  try {
    const onCase = asked("case", "nuc", "Touhou");
    await open.autocomplete(onCase);
    assert.strictEqual(askedFor.page.category, "Touhou", "the shelf narrows the list");
    assert.strictEqual(askedFor.query, "nuc", "and what was typed still filters it");
    assert.strictEqual(onCase.sent[0][0].value, "c1");

    const onSeries = asked("series", "tou", null);
    await open.autocomplete(onSeries);
    assert.strictEqual(onSeries.sent[0][0].value, "Touhou", "the series box lists shelves");
  } finally {
    api.cases = realCases;
    api.categories = realCategories;
  }
});
