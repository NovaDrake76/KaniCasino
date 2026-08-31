const { normalize } = require("./nameFilter");

// swearing in the chat, which is a different problem from a slur and needs a different
// matcher. `nameFilter` looks for its terms anywhere inside the text, because a slur gets
// buried on purpose; doing that here would refuse "class", "assume", "cute" and "disputa".
// every term below is matched as a whole word instead.
//
// this is deliberately the strong stuff. "damn" and "crap" are nobody's problem and a chat
// that rejects them is more irritating than the words are.
const ENABLED = () => process.env.CHAT_PROFANITY !== "false";

// same idea as the slur filter: what people write instead of a letter
const SUBSTITUTES = {
  a: "a4@^",
  b: "b8",
  c: "c(<{[",
  e: "e3&",
  g: "g69q",
  i: "i1!|",
  l: "l1|",
  o: "o0()",
  s: "s5$",
  t: "t7+",
  u: "uv",
  z: "z2",
};

const TERMS = [
  // english
  "fuck", "fucker", "fucking", "fuckin", "fuckoff", "motherfucker", "mofo",
  "shit", "shitty", "bullshit", "shithead",
  "bitch", "bitches", "cunt", "twat", "wanker", "wank",
  "whore", "slut", "pussy", "cock", "dick", "dickhead", "prick",
  "asshole", "arsehole", "dumbass", "jackass", "ass", "arse",
  "bastard", "bollocks", "piss", "pissed",

  // portuguese. most players here are brazilian, so an english-only list is half a filter.
  "caralho", "carai", "porra", "merda", "bosta",
  "buceta", "boceta", "xoxota", "cacete",
  "foda", "fodase", "fudeu", "foder",
  "puta", "putaria", "putinha", "vagabunda",
  "arrombado", "corno", "babaca", "escroto", "punheta",
  "cu", "cuzao", "cuzinho",

  // spanish
  "mierda", "joder", "cono", "gilipollas", "cabron", "pendejo", "verga",
];

// words that are only ever an insult in the wrong mouth, and far more often ordinary:
//
//   pinto    a chick, and a common surname
//   pau      a stick, and half the words in a brazilian sentence about wood
//   rola     the verb "to roll"
//   piranha  a fish, on a site full of animal cases
//   pica     stings, in portuguese and spanish
//   otario   closer to "sucker" than to swearing
//   viado    already blocked as a slur, where it belongs
//
// they are named here so nobody adds them back in a later pass.

// real words a term above would swallow if the boundaries ever came off. the boundaries
// are what does the work, so this is a short list rather than the long one a substring
// matcher needs.
const ALLOW = ["assassin", "cocktail", "shuttlecock", "shiitake", "cuzco"];

const escape = (ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// one letter, plus what people write instead of it, repeated so "fuuuck" still lands
function letterPattern(letter) {
  const variants = SUBSTITUTES[letter] || letter;
  const chars = [...new Set((letter + variants).split(""))].map(escape).join("");
  return `[${chars}*#]+`;
}

// letters may be held apart by punctuation or a space, so "f u c k" and "s.h.i.t" are the
// same word, but only a little of it: an unbounded gap would join words either side.
const GAP = "[\\W_]{0,2}";

function compile(term) {
  const body = normalize(term).split("").map(letterPattern).join(GAP);
  // whole word only. a lookbehind, not \b, because \b would call the "l" in "class" a
  // boundary against the "a" of "ass" and refuse the word.
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, "i");
}

const PATTERNS = TERMS.map((term) => ({ term, re: compile(term) }));
const ALLOWED = ALLOW.map((word) => new RegExp(word, "gi"));

// returns the term it matched, or null. the term is for logging and for tests, never for
// the person typing: telling somebody which pattern they tripped is a guide around it.
function findProfanity(input) {
  if (!ENABLED()) return null;
  const text = normalize(input);
  if (!text.trim()) return null;
  const left = ALLOWED.reduce((rest, re) => rest.replace(re, " "), text);
  const hit = PATTERNS.find(({ re }) => re.test(left));
  return hit ? hit.term : null;
}

const isClean = (input) => findProfanity(input) === null;

module.exports = { TERMS, ALLOW, findProfanity, isClean, ENABLED };
