const BASE_XP = 1000; // XP required for the first level
const GROWTH_RATE = 1.25; // Growth rate for each level

function calculateXPForLevel(level) {
    return Math.floor(BASE_XP * Math.pow(GROWTH_RATE, level - 1));
}

function updateLevel(user, cost) {
    user.walletBalance -= cost;
    user.xp += cost * 5;
    let nextLevelXP = calculateXPForLevel(user.level + 1);

    while (user.xp >= nextLevelXP) {
        user.level += 1;
        nextLevelXP = calculateXPForLevel(user.level + 1);
    }
}

module.exports = updateLevel;