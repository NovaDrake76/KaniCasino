const User = require("../models/User");

// Updating winnings after a game
const updateUserWinnings = async (user, winnings) => {

    // Reset weekly winnings if a week has passed (renmove this when we have a cron job)
    if (new Date() - user.lastWinningsUpdate > 7 * 24 * 60 * 60 * 1000) {
        user.weeklyWinnings = 0;
        user.lastWinningsUpdate = new Date();
    }

    user.weeklyWinnings += winnings;
};

module.exports = updateUserWinnings;
