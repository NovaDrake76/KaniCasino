// cache-control for the public, non-personalised reads (case + item listings). the data is
// the same for everyone and changes only when an admin edits it, so a short ttl lets
// cloudflare serve most hits from its edge instead of crossing to the origin, while a new
// case still shows up within the window. never use this on anything that carries a user.
const publicCache = (res, seconds) => res.set("Cache-Control", `public, max-age=${seconds}`);

// tuned per read: the listing is hit most and must reflect a new case fastest, a single
// case's contents change less often, the full item catalogue least of all.
const TTL = { caseList: 60, caseDetail: 120, itemList: 300 };

module.exports = { publicCache, TTL };
