const test = require("node:test");
const assert = require("node:assert");
const { nextDropAt, windowOf } = require("./coupons");
const { couponMessage } = require("./embeds");

const HOUR = 60 * 60 * 1000;
const at = (iso) => Date.parse(iso);

test("a drop lands inside today's window while there is room, and tomorrow's once it has passed", () => {
  const hours = { from: 12, to: 23 };
  assert.strictEqual(nextDropAt(at("2026-10-27T08:00:00Z"), () => 0, hours), at("2026-10-27T12:00:00Z"));
  assert.strictEqual(nextDropAt(at("2026-10-27T08:00:00Z"), () => 0.999999, hours) < at("2026-10-27T23:00:00Z"), true);
  assert.strictEqual(nextDropAt(at("2026-10-27T15:30:00Z"), () => 0, hours), at("2026-10-27T15:30:00Z"));
  assert.strictEqual(nextDropAt(at("2026-10-27T23:30:00Z"), () => 0, hours), at("2026-10-28T12:00:00Z"));
  for (let i = 0; i < 200; i++) {
    const when = nextDropAt(at("2026-10-28T00:00:00Z"), Math.random, hours);
    assert.ok(when >= at("2026-10-28T12:00:00Z") && when < at("2026-10-28T12:00:00Z") + 11 * HOUR);
  }
});

test("a window that makes no sense falls back to the default", () => {
  assert.deepStrictEqual(windowOf("18-6"), { from: 12, to: 23 });
  assert.deepStrictEqual(windowOf("nonsense"), { from: 12, to: 23 });
  assert.deepStrictEqual(windowOf("0-24"), { from: 0, to: 24 });
});

test("the coupon post prints the code and links straight to it", () => {
  const msg = couponMessage({ code: "K7QX9MPLA2", amount: 500, maxRedemptions: 25, expiresAt: "2026-10-27T13:00:00Z" });
  const embed = msg.embeds[0].toJSON();
  const button = msg.components[0].toJSON().components[0];
  assert.match(embed.description, /\*\*K7QX9MPLA2\*\*/);
  assert.match(embed.description, /<t:1793106000:R>/);
  assert.doesNotMatch(embed.description, /verified|once per account|first|players/);
  assert.strictEqual(button.url, "https://kanicasino.com/coupon/K7QX9MPLA2");
});

test("daisu opens the drop with one of her lines, every blank filled", () => {
  const { COUPON_LINES } = require("./couponLines");
  const drop = { code: "K7QX9MPLA2", amount: 25000, maxRedemptions: 5, expiresAt: "2026-10-27T13:00:00Z" };
  const said = COUPON_LINES.map((_, i) => couponMessage(drop, { random: () => i / COUPON_LINES.length, role: "" }).content);
  assert.strictEqual(new Set(said).size, COUPON_LINES.length);
  for (const line of said) assert.doesNotMatch(line, /[{}]/);
  for (const line of said) assert.doesNotMatch(line, /5/);
  assert.ok(said.includes("I found 25,000 K₽ under the jar. Fastest hands get it, go."));
});

test("a drop pings the fans' role and nothing else, and no role means no ping", () => {
  const drop = { code: "K7QX9MPLA2", amount: 1000, maxRedemptions: 25, expiresAt: "2026-10-27T13:00:00Z" };
  const pinged = couponMessage(drop, { random: () => 0, role: "1565679546005590058" });
  assert.ok(pinged.content.startsWith("<@&1565679546005590058> "));
  assert.deepStrictEqual(pinged.allowedMentions, { roles: ["1565679546005590058"] });

  const quiet = couponMessage(drop, { random: () => 0, role: "" });
  assert.doesNotMatch(quiet.content, /<@&/);
  assert.deepStrictEqual(quiet.allowedMentions, { roles: [] });
});
