const User = require("../models/User");
const Item = require("../models/Item");

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

    // atomically consume the selected items; the pre-update doc tells us how many
    // were actually present, so a concurrent request can't spend them twice
    const before = await User.findOneAndUpdate(
      { _id: userId },
      { $pull: { inventory: { uniqueId: { $in: selectedItemIds } } } }
    );
    if (!before) {
      return { status: 404, message: "User not found" };
    }
    const removedCount = before.inventory.filter((invItem) =>
      selectedItemIds.includes(invItem.uniqueId)
    ).length;
    if (removedCount !== selectedItems.length) {
      return { status: 400, message: "Items no longer available" };
    }

    // Calculate the success rate and attempt the upgrade
    const successRate = calculateSuccessRate(selectedItems, targetItem.rarity);
    const isSuccess = Math.random() < successRate;

    if (isSuccess) {
      // Add the target item to the user's inventory
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
              uniqueId: require('uuid').v4(),
            },
          },
        }
      );
    }

    return { status: 200, success: isSuccess, item: isSuccess ? targetItem : null };
  } catch (error) {
    console.error(error);
    return { status: 500, message: "Internal server error" };
  }
};

module.exports = upgradeItems;
