const test = require("node:test");
const assert = require("node:assert");

process.env.DISCORD_GUILD_ID = "907336089797267496";
process.env.DISCORD_MEMBER_INTENT = "true";
const api = require("./api");
const membership = require("./membership");

const GUILD = "907336089797267496";

test("a join in the home server is pushed to the site", async () => {
  const calls = [];
  api.membership = async (...args) => calls.push(args);

  await membership.pushOne("100000000000000001", GUILD, true);

  assert.deepStrictEqual(calls, [["100000000000000001", GUILD, true]]);
});

test("a join anywhere else is ignored, because only the home server pays", async () => {
  const calls = [];
  api.membership = async (...args) => calls.push(args);

  await membership.pushOne("100000000000000001", "111111111111111111", true);

  assert.strictEqual(calls.length, 0);
});

test("a site that does not answer never takes the bot down with it", async () => {
  api.membership = async () => {
    throw new Error("api down");
  };

  await membership.pushOne("100000000000000001", GUILD, false);
});

test("the boot sync sends the whole member list, which is what heals a missed event", async () => {
  const sent = [];
  api.syncMembers = async (...args) => sent.push(args);
  const client = {
    guilds: {
      fetch: async () => ({
        members: { fetch: async () => new Map([["1", {}], ["2", {}]]) },
      }),
    },
  };

  await membership.syncAll(client);

  assert.deepStrictEqual(sent, [[GUILD, ["1", "2"]]]);
});

test("the privileged intent needs its own flag, not just a guild id", () => {
  // asking for GuildMembers before the developer portal allows it does not degrade the
  // bot, it refuses the login: "Used disallowed intents", and the bot is down. setting a
  // guild id must never be able to do that on its own.
  delete require.cache[require.resolve("./membership")];
  process.env.DISCORD_MEMBER_INTENT = "";
  const withoutFlag = require("./membership");
  assert.strictEqual(withoutFlag.HOME_GUILD_ID, GUILD);
  assert.strictEqual(withoutFlag.WANTS_MEMBER_INTENT, false);

  delete require.cache[require.resolve("./membership")];
  process.env.DISCORD_MEMBER_INTENT = "true";
  assert.strictEqual(require("./membership").WANTS_MEMBER_INTENT, true);
});
