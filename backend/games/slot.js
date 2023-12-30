const SlotGame = require('../models/Slot');
const User = require('../models/User');
const updateLevel = require("../utils/updateLevel");
const updateUserWinnings = require("../utils/updateUserWinnings");

class SlotGameController {

    static async spin(userId, betAmount, io) {

        // Check bet amount
        if (isNaN(betAmount) || betAmount < 0.5 || betAmount > 50000) {
            throw new Error("Invalid bet amount");
        }
        // Check user's balance
        const player = await User.findById(userId).select("-password").select("-email").select("-isAdmin").select("-nextBonus").select("-inventory");
        if (player.walletBalance < betAmount) {
            throw new Error("Insufficient balance");
        }

        updateLevel(player, betAmount);

        // Generate a random grid state
        const gridState = this.generateRandomGrid();

        // Calculate wins
        const winResults = SlotGameController.calculateWins(gridState);

        // Check for special features
        let manekiNekoFeature = false;
        if (this.checkForManekiNeko(gridState)) {
            manekiNekoFeature = true;
            // Implement logic for Maneki-neko feature
        }

        // Calculate total payout
        function calculateTotalPayout(winResults) {
            let totalPayout = 0;
            if (winResults.length > 0) {
                const totalWins = winResults.reduce((total, win) => total + win.payout, 0);
                totalPayout = totalWins * betAmount;
            }
            return totalPayout;
        }

        // Update player's balance 
        if (winResults.length > 0) {
            const totalPayout = calculateTotalPayout(winResults);
            player.walletBalance += totalPayout;
            updateUserWinnings(player, totalPayout);
        }

        await player.save();

        // Emit updated user data
        const updatedUserData = {
            walletBalance: player.walletBalance,
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
            manekiNekoFeature: manekiNekoFeature,
            totalPayout: calculateTotalPayout(winResults)
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

    static checkForManekiNeko(grid) {
        // Define the condition for triggering the Maneki-neko feature
        const triggerCondition = (grid) => {
            return grid[3] === 'wild' && grid[4] === 'wild' && grid[5] === 'wild';
        };

        if (triggerCondition(grid)) {
            const randomSymbol = this.getRandomSymbol();
            const newGrid = this.fillLateralReels(grid, randomSymbol);

            let winAchieved = false;
            while (!winAchieved) {
                this.spinCentralReel(newGrid);
                winAchieved = this.checkWin(newGrid);
            }

            return {
                triggered: true,
                newGrid: newGrid
            };
        } else {
            return { triggered: false };
        }
    }

    static getRandomSymbol() {
        const symbols = ['red', 'blue', 'green', 'yin_yang', 'hakkero', 'yellow', 'wild'];
        return symbols[Math.floor(Math.random() * symbols.length)];
    }

    static fillLateralReels(grid, symbol) {
        return [
            symbol, grid[1], 'wild',
            symbol, grid[4], 'wild',
            symbol, grid[7], 'wild'
        ];
    }

    static spinCentralReel(grid) {
        for (let i of [1, 4, 7]) {
            grid[i] = this.getRandomSymbol();
        }
    }

    static checkWin(grid) {
        const paylines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 4, 8], [2, 4, 6]
        ];

        const wins = [];
        for (const line of paylines) {
            if (grid[line[0]] === grid[line[1]] && grid[line[1]] === grid[line[2]] && grid[line[0]] !== '') {
                wins.push({
                    line: line,
                    symbol: grid[line[0]],
                    multiplier: this.getMultiplier(grid[line[0]])
                });
            }
        }
        return wins;
    }

    static getMultiplier(symbol) {
        const multipliers = {
            'red': 3, 'blue': 5, 'green': 8, 'yin_yang': 10, 'hakkero': 25, 'yellow': 100, 'wild': 250
        };
        return multipliers[symbol] || 0;
    }
}

module.exports = SlotGameController;
