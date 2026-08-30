const test = require("node:test");
const assert = require("node:assert");

process.env.DISCORD_GUILD_ID = "907336089797267496";
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
