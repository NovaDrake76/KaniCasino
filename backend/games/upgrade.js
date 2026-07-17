const User = require("../models/User");
const Item = require("../models/Item");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const { rollFloat, TOTAL } = require("../utils/provablyFair");
const { UPGRADE_RTP } = require("../utils/itemValue");

const UPGRADE_ALGO_VERSION = 2; // bump if calculateSuccessRate ever changes

// nothing is ever a certainty: staking more than the target is worth still leaves a
// sliver of risk, and this is what stops an oversized stake asking for a chance above 1
const MAX_UPGRADE_CHANCE = 0.95;

// the chance is the stake measured against the prize: p = RTP * staked / target. the
// player's return is p * target / staked, so it is UPGRADE_RTP for every trade, and the
// edge is a flat 1 - UPGRADE_RTP whatever mix of rarities goes in.
//
// it used to be read off a rarity-to-rarity table that had nothing to do with the
// rarity multipliers item values are built from. the two were never reconciled, so the
// edge swung from -40% (the player profiting, on 1x rarity-1 -> rarity-4) to +90%
// depending purely on which colors were fed in, and adding a 1 KP item to a 24 KP stake
// bought more chance than it paid for.
const calculateSuccessRate = (stakedValue, targetValue) => {
  if (!(stakedValue > 0) || !(targetValue > 0)) return 0;
  return Math.min((UPGRADE_RTP * stakedValue) / targetValue, MAX_UPGRADE_CHANCE);
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

    // the catalog is the authority on what an item is worth: an inventory entry carries
    // no value at all, and some older ones lost their case too
    const catalog = await Item.find(
      { _id: { $in: [...new Set(selectedItems.map((invItem) => String(invItem._id)))] } },
      { baseValue: 1, case: 1 }
    );
    const sourceById = new Map(catalog.map((item) => [String(item._id), item]));

    // backfill case for items that lost it (e.g. bought before case was preserved)
    for (const item of selectedItems) {
      if (!item.case) {
        const sourceItem = sourceById.get(String(item._id));
        if (sourceItem) item.case = sourceItem.case;
      }
    }

    if (!allItemsFromSameCase([...selectedItems, targetItem])) {
      return { status: 400, message: "All items must be from the same case" };
    }

    if (!verifyLesserRarity(selectedItems, targetItem)) {
      return { status: 400, message: "You can't upgrade to a lesser rarity" };
    }

    const stakedValue = selectedItems.reduce((sum, invItem) => {
      const sourceItem = sourceById.get(String(invItem._id));
      return sum + ((sourceItem && sourceItem.baseValue) || 0);
    }, 0);
    const targetValue = targetItem.baseValue || 0;
    if (!(stakedValue > 0) || !(targetValue > 0)) {
      return { status: 400, message: "These items have no value yet" };
    }

    // reserve the provably-fair nonce up front (atomic, never rolled back)
    const reserved = await seeds.reserveNonces(userId, 1);
    const nonce = reserved.startNonce;

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

    // success is the provably-fair roll: succeed when the [0,1) draw is below the rate
    const successRate = calculateSuccessRate(stakedValue, targetValue);
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
        // the two numbers the rate is derived from, so a past roll stays checkable
        // even after the catalog revalues the items
        stakedValue,
        targetValue,
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
module.exports.MAX_UPGRADE_CHANCE = MAX_UPGRADE_CHANCE;
