// The spin is theatre over an answer the site already gave, so what matters here is that
// every frame is a valid message, that the reel is honest about what is coming, and that
// the reveal says the right things to the right person. Discord will not tell you a
// component is malformed until a player triggers it.
process.env.SITE_URL = process.env.SITE_URL || "https://kanicasino.com";

const test = require("node:test");
const assert = require("node:assert");
const {
  reelRow, buildStrip, spinningFrame, revealFrame, demoFrame, FRAMES, LANDING, WINDOW, MIDDLE,
} = require("./spin");

const ESC = String.fromCharCode(27);
const ANSI = new RegExp(ESC + "\\[[0-9;]*m", "g");
const plain = (row) => row.replace(ANSI, "").replace(/```ansi\n?|```/g, "").trim();
const cells = (row) => plain(row).split("\n").map((line) => line.replace(/▸/g, "").trim());

const POOL = [
  { name: "Yukari", rarity: "4" }, { name: "Remilia", rarity: "3" }, { name: "Yuyuko", rarity: "3" },
  { name: "Reisen", rarity: "2" }, { name: "Nitori", rarity: "2" }, { name: "Cirno", rarity: "1" },
  { name: "Rumia", rarity: "1" }, { name: "Koakuma", rarity: "1" },
];
const WON = { name: "Sumireko", rarity: "5" };
const ITEM = { name: "Yukari", rarity: "5", image: "https://example.test/y.png", value: 41200 };
const text = (json) => json.components.filter((c) => c.type === 10).map((c) => c.content).join("\n");
const row = (json) => json.components.find((c) => c.type === 1);

// the first version drew each frame as its own window into a shuffled list, so the names
// to the right of the marker were not what came next. a player reads those as what is
// about to land. it was not, and that is what made the whole thing read as a lie.
test("what sits right of the marker is what lands next", () => {
  const strip = buildStrip(POOL, WON);
  for (let frame = 0; frame < FRAMES - 1; frame += 1) {
    const comingUp = cells(reelRow(strip, frame))[MIDDLE + 1];
    const landsNext = cells(reelRow(strip, frame + 1))[MIDDLE];
    assert.strictEqual(landsNext, comingUp, `frame ${frame} promised ${comingUp} and gave ${landsNext}`);
  }
});

test("the prize walks in from the right rather than appearing from nowhere", () => {
  const strip = buildStrip(POOL, WON);
  const seen = [];
  for (let frame = 0; frame < FRAMES; frame += 1) seen.push(cells(reelRow(strip, frame)).indexOf(WON.name));
  assert.ok(seen.every((at) => at >= 0), `the prize was off screen at some point: ${seen}`);
  // strictly decreasing: far right, one in, under the marker
  for (let i = 1; i < seen.length; i += 1) assert.ok(seen[i] < seen[i - 1], `did not move: ${seen}`);
  assert.strictEqual(seen[seen.length - 1], MIDDLE, "the last frame puts it under the marker");
});

test("the prize is seated where the last frame's marker will be", () => {
  const strip = buildStrip(POOL, WON);
  assert.strictEqual(strip[LANDING].name, WON.name);
  assert.strictEqual(LANDING, FRAMES - 1 + MIDDLE);
});

test("the strip is long enough that no frame runs off the end", () => {
  const strip = buildStrip(POOL, WON);
  assert.ok(strip.length >= FRAMES - 1 + WINDOW);
});

test("the prize is on the strip however far down the case it sits", () => {
  const strip = buildStrip([{ name: "Kisaki", rarity: "1" }], { name: "Hatsune Miku", rarity: "1" });
  assert.ok(strip.some((entry) => entry.name === "Hatsune Miku"));
});

// two openings of one case scrolling the same names in the same order is what makes a reel
// look like a fixed picture rather than a draw
test("two spins of one case do not scroll the same order", () => {
  const many = new Set(Array.from({ length: 8 }, () => buildStrip(POOL, WON).map((e) => e.name).join(",")));
  assert.ok(many.size > 1, "the strip is shuffled per spin");
});

test("each name is painted by its own rarity", () => {
  const row0 = reelRow(buildStrip(POOL, WON), 0);
  assert.ok(row0.includes(ESC + "["), "colour is in the payload");
  assert.match(row0, /^```ansi/, "discord only renders colour in an ansi block");
  // a unique is the loud one, and it has to differ from a common
  const unique = reelRow([{ name: "A", rarity: "5" }], 0);
  const common = reelRow([{ name: "A", rarity: "1" }], 0);
  assert.notStrictEqual(unique, common);
});

// the reel was one line of five names, which needed ten escape sequences in ninety
// characters, and discord's highlighter silently dropped two: the payload asked for red
// and pink, the client painted grey. the codes were identical to ones it had rendered
// correctly two cells earlier. one span per line is the shape that survives it.
test("no line asks discord for more than one colour", () => {
  const row = reelRow(buildStrip(POOL, WON), 0);
  for (const line of row.split("\n")) {
    const spans = (line.match(new RegExp(ESC + "\\[[0-9;]*m", "g")) || []).length;
    assert.ok(spans <= 2, `a line carried ${spans} escape sequences: ${JSON.stringify(line)}`);
  }
});

test("every name still gets its own line, and its own colour", () => {
  const row = reelRow(buildStrip(POOL, WON), 0);
  const body = row.split("\n").filter((line) => !line.startsWith("```"));
  assert.strictEqual(body.length, WINDOW, "one line per visible name");
  for (const line of body) assert.match(line, new RegExp(ESC + "\\["), "each line is coloured");
});

test("a reel of plain names still renders, since that is what it used to be", () => {
  const row0 = reelRow(["Reimu", "Marisa", "Sanae"], 0);
  assert.match(plain(row0), /Reimu|Marisa|Sanae/);
  assert.match(plain(row0), /▸ /);
});

test("a long name is cut rather than wrapping the row", () => {
  const wide = plain(reelRow([{ name: "Yukari (Blue Archive) The Longest", rarity: "1" }], 0));
  for (const line of wide.split("\n")) assert.ok(line.length < 90, `row too wide: ${line.length}`);
});

test("it still draws a row for a case whose names never arrived", () => {
  assert.match(plain(reelRow([], 0)), /▸/);
  assert.match(plain(reelRow(undefined, 3)), /▸/);
  assert.ok(buildStrip([], null).length >= WINDOW);
});

test("a spinning frame wears no rarity, and the landing wears the prize's", () => {
  const strip = buildStrip(POOL, WON);
  assert.strictEqual(spinningFrame("c", strip, 0, null, "5").toJSON().accent_color, 0x4a4a5a);
  assert.strictEqual(spinningFrame("c", strip, FRAMES - 1, WON.name, "5").toJSON().accent_color, 0xffff6e);
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
    item: ITEM, caseTitle: "c", caseId: "c1", ownerId: "u1", balance: 77671,
    fanRank: { name: "Yukari", count: 140, rank: 1, fans: 14 },
  }).toJSON();
  const whole = JSON.stringify(json);
  assert.doesNotMatch(whole, /77,671/);
  assert.doesNotMatch(whole, /left/);
});

// a fractional balance rendered as "77,671.455", which reads as a typo rather than money
test("a value with a fraction is rounded rather than shown raw", () => {
  const json = revealFrame({ item: { ...ITEM, value: 9.455 }, caseTitle: "c", caseId: "c1", ownerId: "u1" }).toJSON();
  assert.match(text(json), /K₽ 9\b/);
  assert.doesNotMatch(text(json), /9\.455/);
});

test("holding a board says so, and says it differently when the lead is somebody else's", () => {
  const first = text(revealFrame({
    item: ITEM, caseTitle: "c", caseId: "c1", ownerId: "u1",
    fanRank: { name: "Yukari", count: 140, rank: 1, fans: 14 },
  }).toJSON());
  assert.match(first, /#1/);
  assert.match(first, /140 Yukari/);

  const chasing = text(revealFrame({
    item: ITEM, caseTitle: "c", caseId: "c1", ownerId: "u1",
    fanRank: { name: "Yukari", count: 9, rank: 3, fans: 14 },
  }).toJSON());
  assert.match(chasing, /#3/);
  assert.doesNotMatch(chasing, /still \*\*#1\*\*/);
});

// clicking "open another" on somebody else's reveal would charge the clicker, so the
// button has to carry whose it is
test("the open again button carries the case and its owner", () => {
  const json = revealFrame({ item: ITEM, caseTitle: "c", caseId: "case42", ownerId: "user99" }).toJSON();
  const button = row(json).components.find((c) => c.custom_id);
  assert.strictEqual(button.custom_id, "open:case42:user99");
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
      item: { name: "Cirno", rarity: "2", value: 10, image }, caseTitle: "c", caseId: "c1", ownerId: "u1",
    }).toJSON();
    assert.ok(json.components.length > 0, `failed on image ${String(image)}`);
    assert.match(text(json) + JSON.stringify(json.components), /Cirno/);
  }
  assert.ok(demoFrame({ item: { name: "Cirno", rarity: "2" }, caseTitle: "c" }).toJSON().components.length > 0);
});

test("real art is still shown as a thumbnail", () => {
  const json = revealFrame({
    item: { name: "Cirno", rarity: "2", value: 10, image: "https://example.test/c.png" },
    caseTitle: "c", caseId: "c1", ownerId: "u1",
  }).toJSON();
  const section = json.components.find((c) => c.type === 9);
  assert.strictEqual(section.accessory.media.url, "https://example.test/c.png");
});
