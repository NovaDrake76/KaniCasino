const nameFilter = require("./nameFilter");

// the url-safe form of a name. a name with no latin letters in it reduces to nothing, and
// the caller decides what to do about that rather than being handed an invented slug.
const MAX = 60;

const slugify = (value, limit = MAX) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, limit)
    .replace(/^-+|-+$/g, "");

// "saki-kivotos-case" tells you which Saki. the same trick on a souvenir package runs past
// the limit and gets cut mid-word, which names nothing, so it is only used when it fits.
const qualifiedSlug = (name, qualifier) => {
  if (!qualifier) return null;
  const full = slugify(`${name} ${qualifier}`, Infinity);
  return full.length <= MAX ? full : null;
};

// a 24-hex string is an id and nothing else. ObjectId.isValid() also accepts any 12-char
// string, which would swallow 172 real usernames, so the check has to be this one.
const looksLikeId = (value) => /^[0-9a-f]{24}$/i.test(String(value || ""));

// segments the api already owns: /users/me must stay the logged-in player, not whoever
// registered the name "me" first
const RESERVED = new Set([
  "register", "login", "logout", "logout-all", "googlelogin", "me", "notifications",
  "transactions", "ranking", "topplayers", "inventory", "wallet", "badge", "badges",
  "avatar", "avatars", "card-style", "fixeditem", "claimbonus", "profilepicture",
  "admin", "api", "new", "edit", "search", "item", "orders", "buy", "sell",
]);

// the slug a name is entitled to, or undefined when it gets none. a name with no latin
// letters has nothing to make one from, and a name the filter rejects keeps its id url: a
// slur in an opaque id is one thing, the same slur in a shareable indexed url is another.
const baseSlugFor = (name) => {
  const base = slugify(name);
  if (!base) return undefined;
  if (nameFilter.findSlur(String(name)) || nameFilter.findSlur(base)) return undefined;
  return base;
};

// the first free slug for this name: "shiki", then "shiki-2", the way a market gets one.
// a qualifier is tried before the number, because "saki-kivotos-case" says which Saki it is
// and "saki-2" says nothing. returns undefined when the name yields nothing usable, and the
// caller falls back to the id.
async function mintSlug(Model, name, { ignoreId, qualifier } = {}) {
  const base = baseSlugFor(name);
  if (!base) return undefined;
  const free = async (slug) => {
    if (!slug || RESERVED.has(slug)) return false;
    const clash = await Model.exists(ignoreId ? { slug, _id: { $ne: ignoreId } } : { slug });
    return !clash;
  };
  if (await free(base)) return base;
  const qualified = qualifiedSlug(name, qualifier);
  if (qualified && qualified !== base && (await free(qualified))) return qualified;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (await free(candidate)) return candidate;
  }
  return undefined;
}

module.exports = { slugify, baseSlugFor, qualifiedSlug, looksLikeId, mintSlug, RESERVED, MAX };
