const User = require("../models/User");
const Item = require("../models/Item");
const { creditUser, TX } = require("./economy");
const { sellValue } = require("./itemValue");

// shared, race-safe core behind both the inventory-sell endpoint and the
// collections quicksell. it pulls the given inventory entries (by uniqueId) in a
// single atomic write and credits strictly for the copies that write actually
// removed (the pre-image), priced from the live item catalog. it never
// over-credits and never removes a copy without paying for it.
//
// it does NOT decide which copies to sell and makes no "keep one" guarantee of its
// own: the caller chooses the ids. no-double-credit relies on inventory living on
// a single user document (one $pull is one atomic op).
//
// returns { sold, value, walletBalance, removed }, or null if the user is gone.
async function sellUniqueIds(userId, ids, extraMeta = {}) {
  const idList = [...new Set((ids || []).map(String))];
  if (!idList.length) {
    return { sold: 0, value: 0, walletBalance: null, removed: [] };
  }

  // atomic pull; the pre-image (no {new:true}) is exactly what this write removed
  const before = await User.findOneAndUpdate(
    { _id: userId },
    { $pull: { inventory: { uniqueId: { $in: idList } } } }
  );
  if (!before) return null;

  const removed = before.inventory.filter((i) => i && idList.includes(i.uniqueId));
  if (!removed.length) {
    return { sold: 0, value: 0, walletBalance: before.walletBalance, removed: [] };
  }

  // authoritative prices from the live catalog, never from a client-sent snapshot
  const itemIds = [...new Set(removed.map((i) => String(i._id)))];
  const items = await Item.find({ _id: { $in: itemIds } }, { baseValue: 1 });
  const baseById = new Map(items.map((i) => [String(i._id), i.baseValue || 0]));

  const value = removed.reduce(
    (sum, i) => sum + sellValue(baseById.get(String(i._id)) || 0),
    0
  );

  const updated = await creditUser(userId, value, 0, {
    type: TX.ITEM_SELL,
    meta: { count: removed.length, ...extraMeta },
  });

  // the account can vanish between the pull and the credit; the items are gone
  // either way, so report the pre-image balance instead of dereferencing null
  if (!updated) {
    console.error("sellUniqueIds: credit skipped, user vanished mid-sell", String(userId));
  }
  const walletBalance = updated ? updated.walletBalance : before.walletBalance;

  return { sold: removed.length, value, walletBalance, removed };
}

module.exports = { sellUniqueIds };
