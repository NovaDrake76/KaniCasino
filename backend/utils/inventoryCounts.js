const mongoose = require("mongoose");
const User = require("../models/User");

// how many of each item a player holds, tallied inside mongo. the embedded array reaches
// 21k entries and 1.4 MB, and every caller here only ever wanted the counts.
const toId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));

function pipelineFor(userId, itemIds) {
  const stages = [
    { $match: { _id: toId(userId) } },
    { $project: { inventory: { $ifNull: ["$inventory", []] } } },
    { $unwind: "$inventory" },
  ];
  if (itemIds && itemIds.length) {
    stages.push({ $match: { "inventory._id": { $in: itemIds.map(toId) } } });
  }
  return stages;
}

// itemId -> how many copies. an unheld item is simply absent.
async function countsFor(userId, itemIds) {
  const rows = await User.aggregate([
    ...pipelineFor(userId, itemIds),
    { $group: { _id: "$inventory._id", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.n]));
}

// the same tally plus the copies themselves, for the screens that sell one. capped
// because no screen picks hundreds of copies by hand and the rest is pure payload.
async function holdingsFor(userId, itemIds, cap) {
  const rows = await User.aggregate([
    ...pipelineFor(userId, itemIds),
    { $group: { _id: "$inventory._id", n: { $sum: 1 }, uniqueIds: { $push: "$inventory.uniqueId" } } },
    { $addFields: { uniqueIds: { $slice: ["$uniqueIds", cap || 500] } } },
  ]);
  const countById = new Map();
  const uniqueIdsById = new Map();
  for (const row of rows) {
    const id = String(row._id);
    countById.set(id, row.n);
    uniqueIdsById.set(id, row.uniqueIds.filter(Boolean));
  }
  return { countById, uniqueIdsById };
}


// copies whose snapshot says they dropped from this case but which the case no longer
// lists. the snapshot fields are the only record left of what they looked like.
async function extrasFor(userId, caseId, excludeIds, cap) {
  const rows = await User.aggregate([
    { $match: { _id: toId(userId) } },
    { $project: { inventory: { $ifNull: ["$inventory", []] } } },
    { $unwind: "$inventory" },
    {
      $match: {
        "inventory.case": toId(caseId),
        "inventory._id": { $nin: (excludeIds || []).map(toId) },
      },
    },
    {
      $group: {
        _id: "$inventory._id",
        n: { $sum: 1 },
        name: { $first: "$inventory.name" },
        image: { $first: "$inventory.image" },
        rarity: { $first: "$inventory.rarity" },
        uniqueIds: { $push: "$inventory.uniqueId" },
      },
    },
    { $addFields: { uniqueIds: { $slice: ["$uniqueIds", cap || 500] } } },
  ]);
  return rows.map((row) => ({
    _id: String(row._id),
    count: row.n,
    snapshot: { name: row.name, image: row.image, rarity: row.rarity },
    uniqueIds: row.uniqueIds.filter(Boolean),
  }));
}


// the copies a listing is about, picked inside mongo. finding them in node meant reading
// the whole array to take one entry out of it.
async function copiesFor(userId, { uniqueId, itemId, limit }) {
  const stages = [
    { $match: { _id: toId(userId) } },
    { $project: { inventory: { $ifNull: ["$inventory", []] } } },
    { $unwind: "$inventory" },
  ];
  if (uniqueId) stages.push({ $match: { "inventory.uniqueId": String(uniqueId) } });
  else if (itemId) stages.push({ $match: { "inventory._id": toId(itemId) } });
  else return [];

  // newest first, the order the route picked by hand
  stages.push({ $sort: { "inventory.createdAt": -1 } });
  stages.push({ $limit: Math.max(1, Math.min(Number(limit) || 1, 200)) });
  stages.push({ $replaceRoot: { newRoot: "$inventory" } });
  return User.aggregate(stages);
}

module.exports = { countsFor, holdingsFor, extrasFor, copiesFor };
