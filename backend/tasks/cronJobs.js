const cron = require('node-cron');
const User = require('../models/User');
const { pruneEmptyRounds } = require("../utils/roundPrune");
const fandom = require("../utils/fandom");
const badges = require("../utils/badges");
const predictions = require("../utils/predictionSettlement");
const leaderboard = require("../utils/leaderboard");
const ledgerDays = require("../utils/ledgerDays");
const referrals = require("../utils/referrals");

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

        // two small reads per tick; once a day it folds the day that closed, one aggregation inside mongo that returns
        // nothing, and with LEDGER_PRUNE=1 it deletes rows past their retention, an hour of them per command
        cron.schedule('5,15,25,35,45,55 * * * *', async () => {
            try {
                const { folded, deleted } = await ledgerDays.run();
                if (folded) console.log(`Ledger: folded ${folded} day(s) into daily totals.`);
                if (deleted) console.log(`Ledger: deleted ${deleted} rows past retention.`);
            } catch (error) {
                console.error('Error folding the ledger:', error);
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

        // referral payouts a referee's seventh day of play or a staff approval has made due since. reads the
        // verified referees still owed something, their sightings and their ledger days: a few KB every 10 minutes
        cron.schedule('2,12,22,32,42,52 * * * *', async () => {
            try {
                const paid = await referrals.sweepReferrals();
                if (paid) console.log(`Referrals: settled ${paid} referee(s).`);
            } catch (error) {
                console.error('Error settling referrals:', error);
            }
        })
    }
}