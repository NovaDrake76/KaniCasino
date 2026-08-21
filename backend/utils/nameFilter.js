// blocks slurs in anything a player types that other players will see: the username at
// signup and the description under a pinned item.
//
// this is a slur list, not a profanity list. "damn" in a username is nobody's problem;
// what this exists to stop is a racial, ethnic, homophobic or ableist slur sitting on a
// leaderboard where everyone has to read it.
//
// the hard part is not the words, it is the spelling. somebody who wants the slur will
// write n*gga, n1gg4, n-i-g-g-a, ｎｉｇｇｅｒ or нigger, so matching plain strings catches
// almost nothing. every term below is compiled into a pattern that tolerates leetspeak,
// separators, repeats, accents, fullwidth forms and cyrillic lookalikes.

// letters that get written as something else. `*` and `#` are in every class because a
// masked letter is the single most common dodge.
const SUBSTITUTES = {
  a: "a4@^",
  b: "b8",
  c: "c(<{[",
  e: "e3&",
  g: "g69q",
  i: "i1!|ly",
  l: "l1|i",
  o: "o0()",
  s: "s5$z",
  t: "t7+",
  u: "uvw",
  z: "z2s",
};

// cyrillic and greek characters that render as latin ones
const HOMOGLYPHS = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c",
  "у": "y", "х": "x", "і": "i", "һ": "h", "ԁ": "d",
  "α": "a", "ε": "e", "ι": "i", "ο": "o", "ρ": "p",
  "τ": "t", "υ": "u", "ν": "v", "χ": "x",
};

// what somebody would actually have to type. kept deliberately narrow: a broad list
// turns into a machine that rejects real names.
const SLURS = [
  "nigger", "nigga", "niglet",
  "faggot", "fagot", "tranny", "trannie",
  "chink", "gook", "spic", "wetback", "beaner", "kike", "kyke",
  "coon", "jigaboo", "porchmonkey", "sandnigger",
  "raghead", "towelhead", "camelfucker",
  "retard", "retarded", "mongoloid",
  "paki", "abbo", "gypo", "gyppo",
  "shemale", "dyke",
];

// two terms were tried and taken back out, because a scan of the real user table showed
// what they cost:
//
//   "tard"  matched Ruby Stardust and star dud. it sits inside stardust, custard, mustard
//           and bastard, and "retard" already covers what it was there for.
//   "negro" is the ordinary respectful word for a Black person in Portuguese, and most of
//           the people here are Brazilian. blocking it would reject correct pt-BR usage to
//           catch an English slur that "nigger" already catches.
//
// real words and names that a pattern above would otherwise swallow. the classic failure
// mode of every filter like this: scunthorpe, penistone, someone actually called Dyke.
const ALLOW = [
  "cocktail", "shuttlecock", "scunthorpe", "penistone", "lightwater",
  "assassin", "assess", "assist", "bass", "class", "glass", "grass", "mass", "pass",
  "analysis", "analyst", "canal", "arsenal", "arsenic",
  "cumin", "circumstance", "document", "accumulate",
  "dyked", "dykes", "vandyke", "dijk",
  "retardant", "retardation",
  "negroni",
  "pakistan", "pakistani",
  "cooney", "cooning", "raccoon", "cocoon", "tycoon", "lagoon", "monsoon",
  "stardust", "custard", "mustard", "bastard", "standard",
  "spice", "spicy", "despicable", "auspicious", "suspicious",
];

const escape = (ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// one letter becomes "any of the things people write instead of it", repeated, with any
// amount of punctuation or space allowed after it
function letterPattern(letter) {
  const variants = SUBSTITUTES[letter] || letter;
  const chars = [...new Set((letter + variants).split(""))].map(escape).join("");
  return `[${chars}*#]+[\\W_]*`;
}

function compile(term) {
  return new RegExp(term.split("").map(letterPattern).join(""), "i");
}

// the allowed words are matched letter for letter, with no repetition. the `+` that lets a
// slur pattern catch "niiigga" would, on an allowed word, eat past the end of it:
// raccoon's trailing n+ swallowed both n's of raccoonnigger and left "igger" behind.
function compileAllow(term) {
  const exact = term
    .split("")
    .map((letter) => letterPattern(letter).replace("]+[", "][")) 
    .join("");
  return new RegExp(exact, "gi");
}

const PATTERNS = SLURS.map((term) => ({ term, re: compile(term) }));
// still separator tolerant, so "sc-unthorpe" is recognised, but letter for letter
const ALLOWED = ALLOW.map(compileAllow);

// strip everything that is decoration rather than content, so the comparison is between
// what was meant rather than how it was dressed up
function normalize(input) {
  return String(input || "")
    .normalize("NFKD")
    // combining marks, so accented letters fold to their base
    .replace(/[̀-ͯ]/g, "")
    .replace(/[Ѐ-ӿͰ-Ͽ]/g, (ch) => HOMOGLYPHS[ch.toLowerCase()] || ch)
    .toLowerCase();
}

const letters = (input) => normalize(input).replace(/[^a-z]/g, "");

// an allowed word is cut out of the name and the rest is still checked. asking "does this
// name contain an allowed word" instead would hand everybody a skeleton key:
// stardustnigger and raccoonnigger both contain one.
function withoutAllowed(text) {
  return ALLOWED.reduce((left, re) => left.replace(re, " "), text);
}

// returns null when the name is fine, or the term it matched. the term is for logging and
// for tests; it is never shown to the person typing, because telling somebody exactly
// which pattern they tripped is a guide to getting around it.
function findSlur(input) {
  const text = normalize(input);
  if (!text.trim()) return null;
  const left = withoutAllowed(text);
  const hit = PATTERNS.find(({ re }) => re.test(left));
  return hit ? hit.term : null;
}

const isClean = (input) => findSlur(input) === null;

// a google account's display name is not something the person can change to get in, so a
// name that trips the filter falls back to a generated one rather than refusing the login
function safeUsername(name, fallbackSeed) {
  if (isClean(name)) return String(name);
  const seed = String(fallbackSeed || Math.abs(Date.now() % 100000));
  return `player${seed.slice(-5)}`;
}

module.exports = {
  SLURS,
  ALLOW,
  normalize,
  letters,
  withoutAllowed,
  findSlur,
  isClean,
  safeUsername,
};
