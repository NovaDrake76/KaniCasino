const mongoose = require("mongoose");
const User = require("../models/User");
const Item = require("../models/Item");
const FanBoard = require("../models/FanBoard");
const CollectorBoard = require("../models/CollectorBoard");
const { visible } = require("./visibility");
const itemCatalog = require("./itemCatalog");

// how many chasers a board keeps. deep enough that anyone in touching distance sees
// themselves, short enough that a board document stays small.
const RANKS_KEPT = 50;
// a board nobody is chasing is not contested; it sorts behind every real race
const NO_CONTEST = 999999;
const COLLECTORS_KEPT = 100;

// the same character can appear in more than one case, as separate item rows sharing a
// name. the name is the character, so every id behind it counts toward the same board.
async function charactersByName(names) {
  const wanted = names && names.length ? new Set(names) : null;
  const items = (await itemCatalog.all()).filter((item) => !wanted || wanted.has(item.name));
  const byName = new Map();
  for (const item of items) {
    let entry = byName.get(item.name);
    if (!entry) {
      entry = { name: item.name, ids: new Set(), image: item.image, rarity: item.rarity, caseId: item.case };
      byName.set(item.name, entry);
    }
    entry.ids.add(String(item._id));
    if (!entry.image) entry.image = item.image;
    if (!entry.rarity) entry.rarity = item.rarity;
    // the first case the character drops from is where the page sends anyone chasing them
    if (!entry.caseId) entry.caseId = item.case;
  }
  return byName;
}

// an inventory entry identifies its copy by catalog id; only rows written before name,
// image and case moved to the catalog still carry a name of their own, so both count.
const isCopyOf = (entry, character) =>
  !!entry &&
  !!character &&
  (entry.name === character.name || (!!entry._id && character.ids.has(String(entry._id))));

// every catalog id mapped to the character behind it, for the passes that have nothing
// but an inventory entry to go on
function namesById(byName) {
  const map = new Map();
  for (const character of byName.values()) {
    for (const id of character.ids) map.set(id, character.name);
  }
  return map;
}

// the whole catalog keyed by item id, for a caller holding a raw inventory and nothing else
const namesByItemId = () => itemCatalog.namesById();

// a player's standing is counted only for the character they pinned. holding thousands of
// everything else is worth nothing here, which is what keeps one rich account from owning
// every board. items listed on the market are pulled out of the inventory, so they stop
// counting while they are for sale. both counting paths below hold to that.

// how close the chase is: the leader's margin over the runner-up. a board with no leader
// or nobody behind them is not a contest at all.
function gapOf(rows) {
  if (!rows.length || rows[0].count <= 0 || rows.length < 2) return NO_CONTEST;
  return rows[0].count - rows[1].count;
}

// count desc, then whoever pinned it first, then account age. never random.
function byStanding(a, b) {
  if (b.count !== a.count) return b.count - a.count;
  const at = a.since ? a.since.getTime() : Infinity;
  const bt = b.since ? b.since.getTime() : Infinity;
  if (at !== bt) return at - bt;
  return String(a.userId).localeCompare(String(b.userId));
}

// distinct characters first, then total copies as the tie-break, then account age
function byCollection(a, b) {
  if (b.distinct !== a.distinct) return b.distinct - a.distinct;
  if (b.total !== a.total) return b.total - a.total;
  return String(a.userId).localeCompare(String(b.userId));
}

// every account's holdings, counted inside mongo. this used to stream each inventory back
// to the app to count it here: 31 MB every ten minutes over a link that carries about
// 100 KB/s, which left it busy more than half the time for one cron job. only the totals
// come back now, and only for accounts that hold something.
//
// the join is what turns entries into characters, so an entry whose catalog row has since
// been deleted drops out. that is the same thing the boards already say: a character
// nobody can hold has no board.
async function countHoldings() {
  const carry = { pinned: { $first: "$pinned" } };
  return User.aggregate([
    { $match: visible() },
    { $project: { pinned: "$fixedItem.name", inventory: { $ifNull: ["$inventory", []] } } },
    { $unwind: "$inventory" },
    // collapse to one row per copy stack first, so the join runs per item held rather
    // than per copy: a deep inventory is thousands of entries and a handful of items
    { $group: { _id: { user: "$_id", item: "$inventory._id" }, n: { $sum: 1 }, ...carry } },
    { $lookup: { from: "items", localField: "_id.item", foreignField: "_id", as: "catalog" } },
    { $unwind: "$catalog" },
    // the same character can come from more than one case, so the name is the group
    { $group: { _id: { user: "$_id.user", name: "$catalog.name" }, n: { $sum: "$n" }, ...carry } },
    {
      $group: {
        _id: "$_id.user",
        distinct: { $sum: 1 },
        total: { $sum: "$n" },
        count: { $sum: { $cond: [{ $eq: ["$_id.name", "$pinned"] }, "$n", 0] } },
      },
    },
  ]);
}

// one pass over every account: the pinned boards and the collection board come out of the
// same counts, because counting every inventory twice is the expensive part.
async function sweep() {
  const byName = await charactersByName();
  const known = new Set(byName.keys());
  const pinned = new Map();
  const collectors = [];

  // the roster is read without inventories, so someone who pinned a character and holds
  // none of it still gets their row on the board
  const [people, holdings] = await Promise.all([
    User.find(visible()).select("username profilePicture level fixedItem fixedAt").lean(),
    countHoldings(),
  ]);
  const held = new Map(holdings.map((row) => [String(row._id), row]));

  for (const person of people) {
    const mine = held.get(String(person._id));
    if (mine && mine.distinct) {
      collectors.push({
        userId: person._id,
        username: person.username,
        profilePicture: person.profilePicture,
        level: person.level,
        distinct: mine.distinct,
        total: mine.total,
      });
    }

    const name = person.fixedItem && person.fixedItem.name;
    if (!name) continue;
    // a pinned item whose row has since been removed names a character nobody can hold
    // any more, so it gets no board rather than an empty one
    if (!byName.get(name)) continue;

    pinned.set(name, pinned.get(name) || []);
    pinned.get(name).push({
      userId: person._id,
      username: person.username,
      profilePicture: person.profilePicture,
      level: person.level,
      count: mine ? mine.count : 0,
      // accounts that pinned before this shipped have no fixedAt, so they fall back to
      // when the account itself was made
      since: person.fixedAt || person._id.getTimestamp(),
    });
  }

  // every character gets a board, held or not: an empty one is the invitation to take it
  const boards = [];
  for (const character of byName.values()) {
    const rows = pinned.get(character.name) || [];
    rows.sort(byStanding);
    boards.push({
      name: character.name,
      image: character.image,
      rarity: character.rarity,
      caseId: character.caseId || null,
      fanCount: rows.length,
      rows,
    });
  }
  boards.sort((a, b) => b.fanCount - a.fanCount);
  collectors.sort(byCollection);

  return { boards, collectors, characterCount: known.size };
}

// what each player carries around the site. rank 1 is what earns the badge; the rest is
// what their own profile shows them, however far down they are.
function standingsFrom(boards) {
  const standings = new Map();
  for (const board of boards) {
    const runnerUp = board.rows.length > 1 ? board.rows[1].count : 0;
    board.rows.forEach((row, index) => {
      standings.set(String(row.userId), {
        name: board.name,
        image: board.image,
        rarity: board.rarity,
        count: row.count,
        rank: index + 1,
        fans: board.fanCount,
        second: runnerUp,
        since: row.since,
      });
    });
  }
  return standings;
}

// rebuilt whole rather than patched: the write paths that change an inventory are spread
// across cases, market, upgrade and battles, and a counter hooked into all of them would
// drift. nothing here touches a balance.
async function rebuild() {
  const at = new Date();
  const { boards, collectors, characterCount } = await sweep();
  const standings = standingsFrom(boards);

  if (boards.length) {
    await FanBoard.bulkWrite(
      boards.map((board) => ({
        updateOne: {
          filter: { name: board.name },
          update: {
            $set: {
              name: board.name,
              image: board.image,
              rarity: board.rarity,
              caseId: board.caseId,
              fanCount: board.fanCount,
              topCount: board.rows.length ? board.rows[0].count : 0,
              secondCount: board.rows.length > 1 ? board.rows[1].count : 0,
              gap: gapOf(board.rows),
              top: board.rows[0] || null,
              ranks: board.rows.slice(0, RANKS_KEPT),
              updatedAt: at,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }
  // a character nobody pins any more should not keep a board
  await FanBoard.deleteMany({ updatedAt: { $lt: at } });

  await CollectorBoard.updateOne(
    { key: "collection" },
    { $set: { characterCount, ranks: collectors.slice(0, COLLECTORS_KEPT), updatedAt: at } },
    { upsert: true }
  );

  const collectionByUser = new Map(
    collectors.map((row, index) => [String(row.userId), { distinct: row.distinct, total: row.total, rank: index + 1 }])
  );

  const writes = [];
  for (const userId of new Set([...standings.keys(), ...collectionByUser.keys()])) {
    const standing = standings.get(userId);
    const set = { fanStamp: at };
    if (standing) set.fanRank = standing;
    if (collectionByUser.has(userId)) set.collectionRank = collectionByUser.get(userId);
    const unset = {};
    if (!standing) unset.fanRank = "";
    writes.push({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(userId) },
        update: Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set },
      },
    });
  }
  if (writes.length) await User.bulkWrite(writes, { ordered: false });
  // anyone this sweep did not touch has unpinned, sold up or left, so they carry nothing
  await User.updateMany(
    { $or: [{ fanStamp: { $lt: at } }, { fanStamp: { $exists: false }, fanRank: { $exists: true } }] },
    { $unset: { fanRank: "", collectionRank: "", fanStamp: "" } }
  );

  return { boards: boards.length, players: standings.size, collectors: collectors.length };
}

// one board's rows, counted inside mongo. a fan's inventory runs to thousands of entries
// and this reruns on every drop of a pinned character, so only the total comes back.
async function countRows(character) {
  const ids = [...character.ids].map((id) => new mongoose.Types.ObjectId(id));
  const docs = await User.aggregate([
    { $match: visible({ "fixedItem.name": character.name }) },
    {
      $project: {
        username: 1,
        profilePicture: 1,
        level: 1,
        fixedAt: 1,
        count: {
          $size: {
            $filter: {
              input: { $ifNull: ["$inventory", []] },
              as: "entry",
              cond: {
                $or: [
                  { $eq: ["$$entry.name", character.name] },
                  { $in: [{ $ifNull: ["$$entry._id", null] }, ids] },
                ],
              },
            },
          },
        },
      },
    },
  ]);
  return docs.map((doc) => ({
    userId: doc._id,
    username: doc.username,
    profilePicture: doc.profilePicture,
    level: doc.level,
    count: doc.count,
    since: doc.fixedAt || doc._id.getTimestamp(),
  }));
}

// pinning is the moment a player cares most about where they stand, so the boards they
// just joined or left are redone straight away instead of waiting for the next sweep.
async function refreshCharacters(names) {
  const wanted = [...new Set((names || []).filter(Boolean))];
  if (!wanted.length) return { boards: 0 };

  const byName = await charactersByName(wanted);
  const at = new Date();
  const boards = [];

  for (const name of wanted) {
    const character = byName.get(name);
    if (!character) continue;
    const rows = (await countRows(character)).sort(byStanding);
    boards.push({
      name,
      image: character.image,
      rarity: character.rarity,
      caseId: character.caseId || null,
      fanCount: rows.length,
      rows,
    });
  }
  if (!boards.length) return { boards: 0 };

  await FanBoard.bulkWrite(
    boards.map((board) => ({
      updateOne: {
        filter: { name: board.name },
        update: {
          $set: {
            name: board.name,
            image: board.image,
            rarity: board.rarity,
            caseId: board.caseId,
            fanCount: board.fanCount,
            topCount: board.rows.length ? board.rows[0].count : 0,
            secondCount: board.rows.length > 1 ? board.rows[1].count : 0,
            gap: gapOf(board.rows),
            top: board.rows[0] || null,
            ranks: board.rows.slice(0, RANKS_KEPT),
            updatedAt: at,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  const standings = standingsFrom(boards);
  const writes = [...standings].map(([userId, standing]) => ({
    updateOne: {
      filter: { _id: new mongoose.Types.ObjectId(userId) },
      update: { $set: { fanRank: standing, fanStamp: at } },
    },
  }));
  if (writes.length) await User.bulkWrite(writes, { ordered: false });

  // whoever pinned away from these characters keeps a stale badge until they are cleared
  await User.updateMany(
    { fanRank: { $exists: true }, "fanRank.name": { $in: wanted }, _id: { $nin: [...standings.keys()].map((id) => new mongoose.Types.ObjectId(id)) } },
    { $unset: { fanRank: "" } }
  );

  return { boards: boards.length };
}

// an inventory change only moves a board when the item was that player's own pinned
// character. most players pin nothing, so that is the cheap half and it goes first.
async function touchInventory(userIds, itemIds) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
  const items = [...new Set((Array.isArray(itemIds) ? itemIds : [itemIds]).filter(Boolean).map(String))];
  if (!ids.length || !items.length) return { boards: 0 };

  const users = await User.find({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } })
    .select("fixedItem.name")
    .lean();
  const pinned = new Set(users.map((user) => user.fixedItem && user.fixedItem.name).filter(Boolean));
  if (!pinned.size) return { boards: 0 };

  const rows = await Item.find({ _id: { $in: items.map((id) => new mongoose.Types.ObjectId(id)) } })
    .select("name")
    .lean();
  return refreshCharacters([...new Set(rows.map((row) => row.name).filter((name) => pinned.has(name)))]);
}

// a board recount must never be what fails the sale, upgrade or opening that moved
// the item: the next sweep would put it right anyway
const touch = (userIds, itemIds) =>
  touchInventory(userIds, itemIds).catch((err) => console.error("fandom touch:", err.message));

module.exports = {
  rebuild,
  refreshCharacters,
  touchInventory,
  touch,
  sweep,
  standingsFrom,
  charactersByName,
  namesByItemId,
  isCopyOf,
  byStanding,
  byCollection,
  RANKS_KEPT,
  COLLECTORS_KEPT,
};
