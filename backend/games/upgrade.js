const User = require("../models/User");
const Item = require("../models/Item");

// Helper function to validate if all items belong to the same case
const allItemsFromSameCase = (items) => {
    const caseId = items[0].case;
    return items.every((item) => item.case.toString() === caseId.toString());
};

// Helper function to calculate success rate
const calculateSuccessRate = (selectedItems, targetItem) => {
    // Implement your logic to calculate success rate
    // For example: based on the rarity of selectedItems and targetItem
    return 0.5; // 50% success rate
};

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

        if (!allItemsFromSameCase([...selectedItems, targetItem])) {
            return { status: 400, message: "All items must be from the same case" };
        }

        // Remove the selected items from the user's inventory
        user.inventory = user.inventory.filter(
            (invItem) => !selectedItemIds.includes(invItem.uniqueId)
        );

        // Calculate the success rate and attempt the upgrade
        const successRate = calculateSuccessRate(selectedItems, targetItem);
        const isSuccess = Math.random() < successRate;

        if (isSuccess) {
            // Add the target item to the user's inventory
            user.inventory.unshift({
                _id: targetItem._id,
                name: targetItem.name,
                image: targetItem.image,
                rarity: targetItem.rarity,
                case: targetItem.case,
                uniqueId: require('uuid').v4(),
            });
        }

        await user.save();

        return { status: 200, success: isSuccess, item: isSuccess ? targetItem : null };
    } catch (error) {
        console.error(error);
        return { status: 500, message: "Internal server error" };
    }
};

module.exports = upgradeItems;
