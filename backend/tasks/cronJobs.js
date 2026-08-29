const cron = require('node-cron');
const User = require('../models/User');
const { pruneEmptyRounds } = require("../utils/roundPrune");
const fandom = require("../utils/fandom");
const badges = require("../utils/badges");
const predictions = require("../utils/predictionSettlement");
const leaderboard = require("../utils/leaderboard");

module.exports = {
    startCronJobs: function (io) {

        // the weekly prize moved to the daily leaderboard in utils/leaderboard.js. weeklyWinnings is
        // kept because the backoffice reports on it, so it still has to be cleared.
        cron.schedule("0 20 * * 3", async () => {
            try {
                await User.updateMany({}, { weeklyWinnings: 0 });
                console.log("Weekly winnings reset successfully.");
            } catch (error) {
                console.error("Error resetting weekly winnings:", error);
            }
        })

        // the daily board closes on its own clock, so this only has to notice that the
        // clock ran out. settling is idempotent and leased, so a minute tick is safe.
        cron.schedule("* * * * *", async () => {
            try {
                await leaderboard.sweepBoards(io);
            } catch (error) {
                console.error("Error sweeping leaderboards:", error);
            }
        })

        // the fan boards are a full recount, so they run on a clock rather than on every
        // inventory change
        cron.schedule('*/10 * * * *', async () => {
            try {
                const result = await fandom.rebuild();
                console.log(`Fan boards rebuilt: ${result.boards} boards, ${result.players} ranked.`);
                const connected = await badges.sweepConnected(io);
                if (connected) console.log(`Connected badge awarded to ${connected} players.`);
                const collections = await badges.sweepCollections(io);
                if (collections) console.log(`Collection badges awarded: ${collections}.`);
            } catch (error) {
                console.error('Error rebuilding fan boards:', error);
            }
        })

        // a market with a deadline stops taking trades on its own, so a forgotten one
        // does not keep pricing a question that has already been answered
        cron.schedule('* * * * *', async () => {
            try {
                const closed = await predictions.closeExpired();
                if (closed) console.log(`Closed ${closed} markets whose clock ran out.`);
            } catch (error) {
                console.error('Error closing expired markets:', error);
            }
        })

        cron.schedule('30 * * * *', async () => {
            try {
                const removed = await pruneEmptyRounds();
                console.log(`Pruned ${removed} rounds nobody bet on.`);
            } catch (error) {
                console.error('Error pruning empty rounds:', error);
            }
        })
    }
}