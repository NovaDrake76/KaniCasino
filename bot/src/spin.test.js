// The spin is theatre over an answer the site already gave, so what matters here is that
// every frame is a valid message and that the reveal says the right things to the right
// person. Discord will not tell you a component is malformed until a player triggers it.
process.env.SITE_URL = process.env.SITE_URL || "https://kanicasino.com";

const test = require("node:test");
const assert = require("node:assert");
const { reelRow, buildStrip, spinningFrame, revealFrame, demoFrame, FRAMES } = require("./spin");

const NAMES = ["Reimu", "Marisa", "Sanae", "Cirno", "Yukari"];
const ITEM = { name: "Yukari", rarity: "5", image: "https://example.test/y.png", value: 41200 };
const text = (json) => json.components.filter((c) => c.type === 10).map((c) => c.content).join("\n");
const row = (json) => json.components.find((c) => c.type === 1);

test("the reel moves between frames, so it reads as spinning", () => {
  const frames = Array.from({ length: FRAMES }, (_, i) => reelRow(NAMES, i));
  assert.strictEqual(new Set(frames).size, FRAMES, "every frame must differ from the last");
  for (const frame of frames) assert.match(frame, /▐ .+ ▌/, "the marker sits in every frame");
});

// the first version scrolled the case's first twelve items in catalogue order and never
// put the prize on the reel at all, which is exactly what made it read as fake
test("the item actually won is on the strip, however far down the case it sits", () => {
  const strip = buildStrip(["Kisaki", "Shiroko", "Nozomi"], "Hatsune Miku");
  assert.ok(strip.includes("Hatsune Miku"));
});

test("the last frame lands on it, under the marker", () => {
  const won = "Hatsune Miku";
  const strip = buildStrip(["Kisaki", "Shiroko", "Nozomi", "Kanna", "Saori"], won);
  const landing = reelRow(strip, FRAMES - 1, won);
  assert.match(landing, /▐ Hatsune Miku ▌/);
});

test("the landing wears the prize's colour, and the frames before it do not", () => {
  const strip = buildStrip(NAMES, "Yukari");
  const spinning = spinningFrame("c", strip, 0, null, "5").toJSON();
  const landed = spinningFrame("c", strip, 2, "Yukari", "5").toJSON();
  assert.strictEqual(spinning.accent_color, 0x4a4a5a);
  assert.strictEqual(landed.accent_color, 0xffff6e);
});

// two openings of one case scrolling the same five names in the same order is what makes
// a reel look like a fixed picture rather than a draw
test("two spins of one case do not scroll the same order", () => {
  const many = new Set(Array.from({ length: 8 }, () => buildStrip(NAMES, "Yukari").join(",")));
  assert.ok(many.size > 1, "the strip is shuffled per spin");
});

test("a case with barely any items still fills the window", () => {
  const strip = buildStrip(["Only"], "Only");
  assert.ok(strip.length >= 5);
  assert.match(reelRow(strip, 0), /▐/);
});

test("a long name is cut rather than wrapping the row", () => {
  const wide = reelRow(["Yukari (Blue Archive) The Longest"], 0);
  for (const line of wide.split("\n")) assert.ok(line.length < 90, `row too wide: ${line.length}`);
});

test("it still draws a row for a case whose names never arrived", () => {
  assert.match(reelRow([], 0), /▐/);
  assert.match(reelRow(undefined, 3), /▐/);
});

test("a spinning frame wears no rarity, because nothing has been decided", () => {
  const spinning = spinningFrame("Touhou Case", NAMES, 1).toJSON();
  const landed = revealFrame({ item: ITEM, caseTitle: "Touhou Case", caseId: "c1", ownerId: "u1", balance: 10 }).toJSON();
  assert.notStrictEqual(spinning.accent_color, landed.accent_color);
  assert.strictEqual(landed.accent_color, 0xffff6e, "a unique lands gold, the same gold the site paints");
});

test("the reveal names the item, its rarity and what it is worth", () => {
  const json = revealFrame({ item: ITEM, caseTitle: "Touhou Case", caseId: "c1", ownerId: "u1" }).toJSON();
  const body = text(json) + JSON.stringify(json.components.filter((c) => c.type === 9));
  assert.match(body, /Yukari/);
  assert.match(body, /Unique/);
  assert.match(body, /41,200/);
});

// this lands in a public channel, and what somebody has in their wallet is nobody else's
// business there
test("the reveal never shows a balance", () => {
  const json = revealFrame({
    item: ITEM,
    caseTitle: "c",
    caseId: "c1",
    ownerId: "u1",
    balance: 77671,
    fanRank: { name: "Yukari", count: 140, rank: 1, fans: 14 },
  }).toJSON();
  const whole = JSON.stringify(json);
  assert.doesNotMatch(whole, /77,671/);
  assert.doesNotMatch(whole, /left/);
});

// a fractional balance rendered as "77,671.455", which reads as a typo rather than money
test("a value with a fraction is rounded rather than shown raw", () => {
  const json = revealFrame({
    item: { ...ITEM, value: 9.455 }, caseTitle: "c", caseId: "c1", ownerId: "u1",
  }).toJSON();
  assert.match(text(json), /K₽ 9\b/);
  assert.doesNotMatch(text(json), /9\.455/);
});

test("holding a board says so, and says it differently when the lead is somebody else's", () => {
  const first = text(revealFrame({
    item: ITEM, caseTitle: "c", caseId: "c1", ownerId: "u1", balance: 1,
    fanRank: { name: "Yukari", count: 140, rank: 1, fans: 14 },
  }).toJSON());
  assert.match(first, /#1/);
  assert.match(first, /140 Yukari/);

  const chasing = text(revealFrame({
    item: ITEM, caseTitle: "c", caseId: "c1", ownerId: "u1", balance: 1,
    fanRank: { name: "Yukari", count: 9, rank: 3, fans: 14 },
  }).toJSON());
  assert.match(chasing, /#3/);
  assert.doesNotMatch(chasing, /still \*\*#1\*\*/);
});

// clicking "open another" on somebody else's reveal would charge the clicker, so the
// button has to carry whose it is
test("the open again button carries the case and its owner", () => {
  const json = revealFrame({ item: ITEM, caseTitle: "c", caseId: "case42", ownerId: "user99", balance: 1 }).toJSON();
  const button = row(json).components.find((c) => c.custom_id);
  assert.strictEqual(button.custom_id, "open:case42:user99");
  const [action, caseId, ownerId] = button.custom_id.split(":");
  assert.deepStrictEqual([action, caseId, ownerId], ["open", "case42", "user99"]);
  assert.ok(button.custom_id.length <= 100, "discord caps a custom id at 100 characters");
});

test("the demo says plainly that nothing was kept, and offers the way to change that", () => {
  const json = demoFrame({ item: ITEM, caseTitle: "Touhou Case" }).toJSON();
  assert.match(text(json), /This was a demo spin\. Create an account to keep the next rolls\./);
  const link = row(json).components[0];
  assert.strictEqual(link.style, 5, "a link button, not one that charges anybody");
  assert.match(link.url, /^https:\/\//);
});

test("the demo never offers a button that would open another", () => {
  const json = demoFrame({ item: ITEM, caseTitle: "c" }).toJSON();
  for (const component of row(json).components) {
    assert.strictEqual(component.custom_id, undefined, "nothing here should charge somebody with no account");
  }
});

// a section is only valid with an accessory, so building one around a missing picture
// throws, and discord says nothing until a player pulls the item that has none
test("an item with no usable art still builds a frame", () => {
  for (const image of [undefined, null, "", "not-a-url", "javascript:alert(1)"]) {
    const json = revealFrame({
      item: { name: "Cirno", rarity: "2", value: 10, image },
      caseTitle: "c", caseId: "c1", ownerId: "u1", balance: 1,
    }).toJSON();
    assert.ok(json.components.length > 0, `failed on image ${String(image)}`);
    assert.match(text(json) + JSON.stringify(json.components), /Cirno/);
  }
  const demo = demoFrame({ item: { name: "Cirno", rarity: "2" }, caseTitle: "c" }).toJSON();
  assert.ok(demo.components.length > 0);
});

test("real art is still shown as a thumbnail", () => {
  const json = revealFrame({
    item: { name: "Cirno", rarity: "2", value: 10, image: "https://example.test/c.png" },
    caseTitle: "c", caseId: "c1", ownerId: "u1", balance: 1,
  }).toJSON();
  const section = json.components.find((c) => c.type === 9);
  assert.ok(section, "art means a section with an accessory");
  assert.strictEqual(section.accessory.media.url, "https://example.test/c.png");
});
