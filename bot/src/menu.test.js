// The menu is the way in for a player who does not know the commands exist, so the shapes
// it builds have to be valid before a player finds out otherwise: discord rejects a select
// with an empty value or a custom id over 100 characters at the moment somebody clicks it,
// not when it is built.
process.env.SITE_URL = process.env.SITE_URL || "https://kanicasino.com";

const test = require("node:test");
const assert = require("node:assert");
const { ID, PER_PAGE, NO_CATEGORY, isMenu, parseMenu, categoryFrame, caseFrame, label, tokenOf } = require("./menu");

const json = (frame) => frame.toJSON();
const rows = (frame) => json(frame).components.filter((c) => c.type === 1);
const select = (frame) => rows(frame).flatMap((r) => r.components).find((c) => c.type === 3);
const buttons = (frame) => rows(frame).flatMap((r) => r.components).filter((c) => c.type === 2);
const text = (frame) => json(frame).components.filter((c) => c.type === 10).map((c) => c.content).join("\n");

const CATEGORIES = [
  { name: "Counter-Strike", count: 42, from: 15 },
  { name: "Blue Archive", count: 8, from: 30 },
];
const cases = (n, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `case${offset + i}`, title: `Case ${offset + i}`, price: (offset + i + 1) * 10 }));

test("a category resolves back out of a custom id, punctuation and all", () => {
  for (const name of ["Counter-Strike", "Re:Zero", "Uma Musume", "a|b", NO_CATEGORY]) {
    const parsed = parseMenu(ID.cases(name, 25));
    assert.equal(parsed.token, tokenOf(name));
    assert.equal(parsed.offset, 25);
    assert.equal(parsed.kind, "case");
  }
});

// two shelves resolving to the same token would page one and render the other
test("distinct categories get distinct tokens", () => {
  const names = ["Counter-Strike", "Blue Archive", "Uma Musume", "Touhou", "Animals", NO_CATEGORY, ""];
  assert.equal(new Set(names.map(tokenOf)).size, names.length);
});

// discord refuses a custom id over 100 characters, and a category is free text with no
// length limit of its own, so the id must not grow with the name
test("a custom id stays inside discord's 100 character limit whatever the name", () => {
  const long = "A very long series name that somebody could plausibly type into the admin panel one day".repeat(4);
  assert.ok(ID.cases(long, 100).length <= 100, ID.cases(long, 100).length + " characters");
  assert.ok(ID.page(long, 100).length <= 100);
});

test("every menu id is routable on the one prefix", () => {
  assert.ok(isMenu(ID.category));
  assert.ok(isMenu(ID.back));
  assert.ok(isMenu(ID.cases("Touhou", 0)));
  assert.ok(isMenu(ID.page("Touhou", 25)));
  assert.equal(isMenu("open:abc:123"), false);
  assert.equal(isMenu(undefined), false);
});

test("the series menu offers one option per shelf, with its count", () => {
  const options = select(categoryFrame(CATEGORIES)).options;
  assert.equal(options.length, 2);
  assert.equal(options[0].value, "Counter-Strike");
  assert.match(options[0].description, /42 cases/);
});

test("an uncategorised shelf is called Other and still carries a usable value", () => {
  const options = select(categoryFrame([{ name: NO_CATEGORY, count: 2, from: 30 }])).options;
  assert.equal(options[0].label, "Other");
  assert.ok(options[0].value.length > 0);
  assert.equal(label(NO_CATEGORY), "Other");
});

// a site with no cases under the discord price cap must not build a select with no options
test("no shelves renders a message rather than an empty select", () => {
  const frame = categoryFrame([]);
  assert.equal(select(frame), undefined);
  assert.match(text(frame), /No cases/i);
});

test("a shelf that fits on one page offers no pager", () => {
  const labels = buttons(caseFrame({ category: "Touhou", cases: cases(3), total: 3, offset: 0 })).map((b) => b.label);
  assert.deepEqual(labels.filter((l) => l === "Next" || l === "Previous"), []);
  assert.ok(labels.includes("Series"));
});

test("the first page of a long shelf offers Next and not Previous", () => {
  const frame = caseFrame({ category: "Counter-Strike", cases: cases(PER_PAGE), total: 42, offset: 0 });
  const labels = buttons(frame).map((b) => b.label);
  assert.ok(labels.includes("Next"));
  assert.ok(!labels.includes("Previous"));
  assert.match(text(frame), /showing 1-25/);
});

test("the last page offers Previous and not Next", () => {
  const frame = caseFrame({ category: "Counter-Strike", cases: cases(17, 25), total: 42, offset: 25 });
  const labels = buttons(frame).map((b) => b.label);
  assert.ok(labels.includes("Previous"));
  assert.ok(!labels.includes("Next"));
  assert.match(text(frame), /showing 26-42/);
});

// paging backwards from the second page has to land on 0, not on a negative offset
test("Previous never pages past the start", () => {
  const back = buttons(caseFrame({ category: "Counter-Strike", cases: cases(17, 25), total: 42, offset: 25 }))
    .find((b) => b.label === "Previous");
  assert.equal(parseMenu(back.custom_id).offset, 0);
  assert.equal(parseMenu(back.custom_id).token, tokenOf("Counter-Strike"));
});

test("a case option carries the id as its value, which is what gets opened", () => {
  const options = select(caseFrame({ category: "Touhou", cases: cases(2), total: 2, offset: 0 })).options;
  assert.deepEqual(options.map((o) => o.value), ["case0", "case1"]);
});

// an empty shelf can only happen if the catalogue changes between the two clicks, and a
// select with no options is rejected by discord rather than ignored
test("a shelf that empties between clicks renders without a select", () => {
  const frame = caseFrame({ category: "Touhou", cases: [], total: 0, offset: 0 });
  assert.equal(select(frame), undefined);
  assert.ok(buttons(frame).some((b) => b.label === "Series"));
});

// A spin the menu started is its own message, so nothing upstream can rewrite it into the
// error. If this frame is wrong the player is left watching "Opening…" forever.
const { failedFrame } = require("./commands");

test("a refusal the player can act on is repeated verbatim", () => {
  const frame = failedFrame({ status: 403, message: "That costs K₽ 500 and you have K₽ 12." });
  assert.match(text(frame), /you have/);
});

test("anything else says the site is unwell rather than leaking it", () => {
  for (const err of [{ status: 500, message: "ECONNREFUSED 127.0.0.1:5001" }, undefined]) {
    assert.match(text(failedFrame(err)), /did not answer/i);
  }
});
