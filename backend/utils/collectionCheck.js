const mongoose = require("mongoose");
const User = require("../models/User");

const toId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));

// the collectible cases, each as the ids of the items it lists that still exist, compared against one player's inventory inside mongo; nothing but the answer comes back.
// a case can still list a deleted item, so each list is joined against the items that exist, and an inventory with fewer distinct items than minItems stops before the join
const pipelineFor = (userId, { categories, minItems = 0 }, answer) => {
  const caseMatch = { collectible: { $ne: false } };
  if (categories) caseMatch.category = { $in: categories };
  return [
    { $match: { _id: toId(userId) } },
    { $project: { owned: { $setUnion: [{ $ifNull: ["$inventory._id", []] }, []] } } },
    { $match: { $expr: { $gte: [{ $size: "$owned" }, minItems] } } },
    {
      $lookup: {
        from: "cases",
        pipeline: [
          { $match: caseMatch },
          { $project: { category: 1, items: 1 } },
          { $lookup: { from: "items", localField: "items", foreignField: "_id", pipeline: [{ $project: { _id: 1 } }], as: "live" } },
          { $project: { category: 1, ids: "$live._id" } },
          { $match: { "ids.0": { $exists: true } } },
        ],
        as: "cases",
      },
    },
    { $project: { _id: 0, answer } },
  ];
};

// how many single cases the player holds every item of: the mission's unit, and the Collections page's
async function casesCompletedBy(userId) {
  const answer = { $size: { $filter: { input: "$cases", as: "c", cond: { $setIsSubset: ["$$c.ids", "$owned"] } } } };
  const [row] = await User.aggregate(pipelineFor(userId, {}, answer));
  return row ? row.answer : 0;
}

// the named categories, each with how many of its cases exist and how many the player holds whole
async function categoriesHeldBy(userId, categories, minItems) {
  const answer = {
    $map: {
      input: "$cases",
      as: "c",
      in: { category: "$$c.category", held: { $setIsSubset: ["$$c.ids", "$owned"] } },
    },
  };
  const [row] = await User.aggregate(pipelineFor(userId, { categories, minItems }, answer));
  return row ? row.answer : [];
}

module.exports = { casesCompletedBy, categoriesHeldBy };
