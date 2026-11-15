const test = require("node:test");
const assert = require("node:assert");
const { STEP, nextCheckAt, settledIn } = require("./lottery");
const { lotteryMessage } = require("./embeds");

const at = (iso) => Date.parse(iso);

test("the checks run on a five-minute grid for two hours after the 20:00 utc draw", () => {
  assert.strictEqual(nextCheckAt(at("2026-11-14T08:00:00Z")), at("2026-11-14T20:01:00Z"));
  assert.strictEqual(nextCheckAt(at("2026-11-14T20:01:00Z")), at("2026-11-14T20:01:00Z"));
  assert.strictEqual(nextCheckAt(at("2026-11-14T20:01:00Z") + 1), at("2026-11-14T20:06:00Z"));
  assert.strictEqual(nextCheckAt(at("2026-11-14T21:56:00Z") + 1), at("2026-11-15T20:01:00Z"));
  assert.strictEqual(nextCheckAt(at("2026-11-14T23:30:00Z")), at("2026-11-15T20:01:00Z"));
});

test("a settled draw falls in exactly one check's window, so a restart cannot post it twice", () => {
  const draw = { number: 7, settledAt: "2026-11-14T20:00:04Z" };
  const checks = [];
  for (let t = nextCheckAt(at("2026-11-14T19:00:00Z")); t < at("2026-11-14T22:00:00Z"); t = nextCheckAt(t + 1)) checks.push(t);
  assert.strictEqual(checks.length, 24);
  const posting = checks.filter((t) => settledIn(draw, t - STEP, t));
  assert.deepStrictEqual(posting, [at("2026-11-14T20:01:00Z")]);
  assert.strictEqual(settledIn({ number: 6, settledAt: "2026-11-13T20:00:04Z" }, at("2026-11-14T20:01:00Z") - STEP, at("2026-11-14T20:01:00Z")), false);
  assert.strictEqual(settledIn(null, 0, Date.now()), false);
});

const next = { number: 8, drawAt: "2026-11-15T20:00:00Z", jackpot: 25000 };

test("a rollover says so and quotes the next pot, with a link and no pings", () => {
  const msg = lotteryMessage({ number: 7, numbers: [3, 7, 19], jackpot: 26200, jackpotEach: 0, jackpotWinners: [] }, { ...next, jackpot: 26200 });
  const embed = msg.embeds[0].toJSON();
  const button = msg.components[0].toJSON().components[0];
  assert.strictEqual(embed.title, "Lottery draw #7: 3 · 7 · 19");
  assert.match(embed.description, /Nobody matched 3\. The 26,200 K₽ jackpot rolls over\./);
  assert.match(embed.description, /Next draw <t:1794772800:R>, jackpot \*\*26,200 K₽\*\*/);
  assert.strictEqual(button.url, "https://kanicasino.com/lottery");
  assert.deepStrictEqual(msg.allowedMentions, { parse: [] });
  assert.strictEqual(msg.content, undefined);
});

test("a won jackpot names its winners", () => {
  const one = lotteryMessage({ number: 7, numbers: [1, 2, 3], jackpot: 25090, jackpotEach: 12545, jackpotWinners: [{ username: "kani_chan", tickets: 2 }] }, next);
  assert.match(one.embeds[0].toJSON().description, /^Jackpot won by \*\*kani\\_chan\*\*: 25,090 K₽\./);
  const two = lotteryMessage({ number: 7, numbers: [1, 2, 3], jackpot: 25090, jackpotEach: 12545, jackpotWinners: [{ username: "kani", tickets: 1 }, { username: "nova", tickets: 1 }] }, next);
  assert.match(two.embeds[0].toJSON().description, /^Jackpot won by \*\*kani\*\*, \*\*nova\*\*: 12,545 K₽ each\./);
});
