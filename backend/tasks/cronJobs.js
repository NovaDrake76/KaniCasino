const cron = require('node-cron');
const User = require('../models/User');
const Notification = require("../models/Notification");

module.exports = {
    startCronJobs: function (io) {

        // Schedule a task to run every wesnesday at 8 pm -3 UTC
        cron.schedule('0 20 * * 3', async () => {
            try {
                //get the top 3 users and set the next bonus to 10000, 5000, 2500
                const topUsers = await User.find({}).sort({ weeklyWinnings: -1 }).limit(3);
                const bonus = [10000, 5000, 2500];
                for (let i = 0; i < topUsers.length; i++) {
                    const user = topUsers[i];
                    user.bonusAmount = bonus[i];
                    await user.save();

                    // Create a new notification
                    const newNotification = new Notification({
                        senderId: user._id,
                        receiverId: user._id,
                        type: 'message',
                        title: `Award - ${i + 1} place`,
                        content: `You have been awarded K₽${bonus[i]} for being in the top 3 on the leaderboard!`,
                    });

                    // Save the notification to the database
                    await newNotification.save();

                    // Emit an event to the user
                    io.to(user._id.toString()).emit("newNotification", {
                        message: `You have been awarded K₽${bonus[i]} for being in the top 3 on the leaderboard!`
                    });
                }

                // Reset weekly winnings for all users
                await User.updateMany({}, { weeklyWinnings: 0 });

                console.log('Weekly winnings reset successfully.');
            } catch (error) {
                console.error('Error resetting weekly winnings:', error);
            }
        })
    }
}