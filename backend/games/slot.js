const { chargeUser, creditUser } = require("../utils/economy");

class SlotGameController {

    static async spin(userId, betAmount, io) {

        // Check bet amount
        if (isNaN(betAmount) || betAmount < 1 || betAmount > 50000) {
            throw new Error("Invalid bet amount");
        }

        // atomically take the stake, rejecting if the balance can't cover it
        const player = await chargeUser(userId, betAmount);
        if (!player) {
            throw new Error("Insufficient balance");
        }

        // Generate a random grid state
        const gridState = this.generateRandomGrid();

        // Calculate wins
        const winResults = SlotGameController.calculateWins(gridState);

        // Calculate total payout
        function calculateTotalPayout(winResults) {
            let totalPayout = 0;
            if (winResults.length > 0) {
                const totalWins = winResults.reduce((total, win) => total + win.payout, 0);
                totalPayout = totalWins * betAmount;
            }
            return totalPayout;
        }

        const totalPayout = calculateTotalPayout(winResults);

        // pay out winnings atomically
        let balanceAfter = player.walletBalance;
        if (totalPayout > 0) {
            const credited = await creditUser(userId, totalPayout, totalPayout);
            balanceAfter = credited.walletBalance;
        }

        // Emit updated user data
        const updatedUserData = {
            walletBalance: balanceAfter,
            xp: player.xp,
            level: player.level,
        };

        setTimeout(() => {
            io.to(userId.toString()).emit('userDataUpdated', updatedUserData);
        }, 3000);

        // Return the game state
        return {
            userId: userId,
            betAmount: betAmount,
            gridState: gridState,
            lastSpinResult: winResults,
            totalPayout: totalPayout
        };
    }

    static generateRandomGrid() {
        const symbolFrequencies = {
            'red': 100,     // Common, low payout
            'blue': 90,
            'green': 80,
            'yin_yang': 50, // Moderate rarity and payout
            'hakkero': 30,  // Rarer, higher payout
            'yellow': 20,   // Rare, high payout
            'wild': 20
        };

        let symbolPool = [];
        for (const symbol in symbolFrequencies) {
            for (let i = 0; i < symbolFrequencies[symbol]; i++) {
                symbolPool.push(symbol);
            }
        }

        let grid = [];
        for (let i = 0; i < 9; i++) {
            const randomIndex = Math.floor(Math.random() * symbolPool.length);
            grid.push(symbolPool[randomIndex]);
        }
        return grid;
    }



    static calculateWins(grid) {
        const symbolPayouts = {
            red: 0.5,
            blue: 1,
            green: 3,
            yin_yang: 8,
            hakkero: 12,
            yellow: 25,
            wild: 100
        };

        let wins = [];

        // Helper function to calculate payout for a line
        const calculateLinePayout = (line) => {
            if (line.every(symbol => symbol === line.find(sym => sym !== 'wild') || symbol === 'wild')) {
                const mainSymbol = line.find(sym => sym !== 'wild') || line[0];
                return symbolPayouts[mainSymbol];
            }
            return 0;
        };

        // Check horizontal lines
        for (let i = 0; i < 9; i += 3) {
            const line = [grid[i], grid[i + 1], grid[i + 2]];
            const payout = calculateLinePayout(line);
            if (payout > 0) wins.push({ line: `Horizontal ${i / 3 + 1}`, payout });
        }

        // Check vertical lines
        // for (let i = 0; i < 3; i++) {
        //     const line = [grid[i], grid[i + 3], grid[i + 6]];
        //     const payout = calculateLinePayout(line);
        //     if (payout > 0) wins.push({ line: `Vertical ${i + 1}`, payout });
        // }

        // Check diagonals
        const diagonal1 = [grid[0], grid[4], grid[8]];
        const diagonal2 = [grid[2], grid[4], grid[6]];
        const diagonal1Payout = calculateLinePayout(diagonal1);
        const diagonal2Payout = calculateLinePayout(diagonal2);
        if (diagonal1Payout > 0) wins.push({ line: "Diagonal 1", payout: diagonal1Payout });
        if (diagonal2Payout > 0) wins.push({ line: "Diagonal 2", payout: diagonal2Payout });

        return wins;
    }
}

module.exports = SlotGameController;
