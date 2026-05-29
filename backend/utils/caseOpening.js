const { v4: uuidv4 } = require("uuid");

// drop-rate weights per rarity
const Rarities = [
  { id: "1", chance: 0.7992 },
  { id: "2", chance: 0.1598 },
  { id: "3", chance: 0.032 },
  { id: "4", chance: 0.0064 },
  { id: "5", chance: 0.0026 },
];

function groupItemsByRarity(items) {
  const itemsByRarity = {};
  items.forEach((item) => {
    if (!itemsByRarity[item.rarity]) {
      itemsByRarity[item.rarity] = [];
    }
    itemsByRarity[item.rarity].push(item);
  });
  return itemsByRarity;
}

function getRandomWeightedItem(items, weightPropertyName) {
  const randomNumber = Math.random();
  let cumulativeWeight = 0;
  for (const item of items) {
    cumulativeWeight += item[weightPropertyName];
    if (randomNumber <= cumulativeWeight) {
      return item;
    }
  }
  return items[items.length - 1];
}

function getRandomItemFromRarity(itemsByRarity, rarity) {
  const items = itemsByRarity[rarity];
  if (!items || items.length === 0) {
    return null;
  }
  return items[Math.floor(Math.random() * items.length)];
}

const getWinningItem = (caseData) => {
  const itemsByRarity = groupItemsByRarity(caseData.items);
  const winningRarity = getRandomWeightedItem(Rarities, "chance");
  let winningItem = getRandomItemFromRarity(itemsByRarity, winningRarity.id);

  if (!winningItem) {
    const existingRarities = Object.keys(itemsByRarity);
    const randomExistingRarity = existingRarities[Math.floor(Math.random() * existingRarities.length)];
    winningItem = getRandomItemFromRarity(itemsByRarity, randomExistingRarity);
  }
  return winningItem;
};

const addUniqueInfoToItem = (item) => {
  return {
    _id: item._id,
    name: item.name,
    image: item.image,
    rarity: item.rarity,
    case: item.case,
    uniqueId: uuidv4(),
  };
};

module.exports = {
  Rarities,
  getWinningItem,
  addUniqueInfoToItem,
};
