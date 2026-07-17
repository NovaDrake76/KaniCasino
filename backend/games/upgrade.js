const User = require("../models/User");
const Item = require("../models/Item");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const { rollFloat, TOTAL } = require("../utils/provablyFair");

const UPGRADE_ALGO_VERSION = 1; // bump if calculateSuccessRate ever changes

const baseChances = {
  "1": { "1": 0.5, "2": 0.2, "3": 0.1, "4": 0.05, "5": 0.002 },
  "2": { "1": 0.2, "2": 0.5, "3": 0.2, "4": 0.1, "5": 0.01 },
  "3": { "1": 0.1, "2": 0.2, "3": 0.5, "4": 0.2, "5": 0.05 },
  "4": { "1": 0.05, "2": 0.1, "3": 0.2, "4": 0.5, "5": 0.1 },
  "5": { "1": 0.002, "2": 0.01, "3": 0.05, "4": 0.1, "5": 0.5 }
};

const rarityFactors = { "4": 0.7, "5": 0.5 };
const rarityCaps = { "1": 0.8, "2": 0.7, "3": 0.6, "4": 0.45, "5": 0.2 };
const diminishingRate = 0.9; // 90% effectiveness for each subsequent item

// success rate uses 1 - product(1 - chance), so each item can only help. the
// per-item contributions are sorted strongest-first before the diminishing
// factor is applied, which makes the result independent of selection order and
// keeps it monotonic (adding an item never lowers the rate).
const calculateSuccessRate = (selectedItems, targetRarity) => {
  const rarityFactor = rarityFactors[targetRarity] || 1;

  const contributions = selectedItems
    .map((item) => {
      const baseChance = (baseChances[item.rarity] || {})[targetRarity] || 0;
      return baseChance * rarityFactor;
    })
    .sort((a, b) => b - a);

  let failChance = 1;
  contributions.forEach((chance, index) => {
    failChance *= 1 - chance * Math.pow(diminishingRate, index);
  });

  const successRate = 1 - failChance;
  const cap = rarityCaps[targetRarity] !== undefined ? rarityCaps[targetRarity] : 0.8;
  return Math.min(successRate, cap);
};

// Helper function to validate if all items belong to the same case
const allItemsFromSameCase = (items) => {
  const caseId = items[0].case;
  if (!caseId) return false;
  return items.every((item) => item.case && item.case.toString() === caseId.toString());
};

const verifyLesserRarity = (selectedItems, targetItem) => {
  for (const item of selectedItems) {
    if (Number(item.rarity) > Number(targetItem.rarity)) {
      return false;
    }
  }
  return true;
}

const upgradeItems = async (userId, selectedItemIds, targetItemId) => {
  try {
    // Fetch the user
    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, message: "User not found" };
    }

    // Fetch the selected items and target item
    const selectedItems = user.inventory.filter((invItem) =>
      selectedItemIds.includes(invItem.uniqueId)
    );
    const targetItem = await Item.findById(targetItemId);

    // Validation checks
    if (!targetItem) {
      return { status: 400, message: "No target item selected" };
    }

    if (selectedItems.length === 0) {
      return { status: 400, message: "No items selected" };
    }

    // backfill case for items that lost it (e.g. bought before case was preserved)
    for (const item of selectedItems) {
      if (!item.case) {
        const sourceItem = await Item.findById(item._id);
        if (sourceItem) item.case = sourceItem.case;
      }
    }

    if (!allItemsFromSameCase([...selectedItems, targetItem])) {
      return { status: 400, message: "All items must be from the same case" };
    }

    if (!verifyLesserRarity(selectedItems, targetItem)) {
      return { status: 400, message: "You can't upgrade to a lesser rarity" };
    }

    // reserve the provably-fair nonce up front (atomic, never rolled back)
    const reserved = await seeds.reserveNonces(userId, 1);
    const nonce = reserved.startNonce;

    // consume the selected items in one atomic step. the filter demands every one of
    // them is still there, so a request that loses the race to a sale or another
    // upgrade removes nothing at all. it used to $pull first and count afterwards,
    // which meant losing that race destroyed whichever items it did still find.
    const consumeIds = selectedItems.map((invItem) => invItem.uniqueId);
    const before = await User.findOneAndUpdate(
      { _id: userId, "inventory.uniqueId": { $all: consumeIds } },
      { $pull: { inventory: { uniqueId: { $in: consumeIds } } } }
    );
    if (!before) {
      return { status: 400, message: "Items no longer available" };
    }

    // success is the provably-fair roll: succeed when the [0,1) draw is below the rate
    const successRate = calculateSuccessRate(selectedItems, targetItem.rarity);
    const rollFloatValue = rollFloat(reserved.serverSeed, reserved.clientSeed, nonce);
    const isSuccess = rollFloatValue < successRate;

    let producedUniqueId = null;
    if (isSuccess) {
      // Add the target item to the user's inventory
      producedUniqueId = require('uuid').v4();
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            inventory: {
              _id: targetItem._id,
              name: targetItem.name,
              image: targetItem.image,
              rarity: targetItem.rarity,
              case: targetItem.case,
              createdAt: new Date(),
              uniqueId: producedUniqueId,
            },
          },
        }
      );
    }

    const rec = await rolls.recordRoll({
      game: "upgrade",
      userId,
      seedId: reserved.seedId,
      clientSeed: reserved.clientSeed,
      serverSeedHash: reserved.serverSeedHash,
      nonce,
      roll: Math.floor(rollFloatValue * TOTAL) + 1,
      total: TOTAL,
      uniqueId: producedUniqueId,
      outcome: {
        success: isSuccess,
        successRate,
        targetItemId: String(targetItem._id),
        targetRarity: targetItem.rarity,
        algoVersion: UPGRADE_ALGO_VERSION,
      },
    });

    return {
      status: 200,
      success: isSuccess,
      item: isSuccess ? targetItem : null,
      rollId: rec.rollId,
    };
  } catch (error) {
    console.error(error);
    return { status: 500, message: "Internal server error" };
  }
};

module.exports = upgradeItems;
// exposed for unit testing
module.exports.calculateSuccessRate = calculateSuccessRate;
module.exports.baseChances = baseChances;
