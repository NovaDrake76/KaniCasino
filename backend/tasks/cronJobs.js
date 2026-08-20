const cron = require('node-cron');
const User = require('../models/User');
const Notification = require("../models/Notification");
const { pruneEmptyRounds } = require("../utils/roundPrune");
const fandom = require("../utils/fandom");

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

        // the fan boards are a full recount, so they run on a clock rather than on every
        // inventory change
        cron.schedule('*/10 * * * *', async () => {
            try {
                const result = await fandom.rebuild();
                console.log(`Fan boards rebuilt: ${result.boards} boards, ${result.players} ranked.`);
            } catch (error) {
                console.error('Error rebuilding fan boards:', error);
            }
        })

        cron.schedule('30 4 * * *', async () => {
            try {
                const removed = await pruneEmptyRounds();
                console.log(`Pruned ${removed} rounds nobody bet on.`);
            } catch (error) {
                console.error('Error pruning empty rounds:', error);
            }
        })
    }
}