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
