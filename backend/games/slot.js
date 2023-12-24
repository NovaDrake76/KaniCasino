const SlotGame = require('../models/Slot');
const User = require('../models/User');
const updateLevel = require("../utils/updateLevel");
const updateUserWinnings = require("../utils/updateUserWinnings");

class SlotGameController {

    static async spin(userId, betAmount, io) {
        // Check user's balance
        const player = await User.findById(userId).select("-password").select("-email").select("-isAdmin").select("-nextBonus").select("-inventory");
        if (player.walletBalance < betAmount) {
            throw new Error("Insufficient balance");
        }

        updateLevel(player, betAmount);


        // Initialize the game state
        let gameState = new SlotGame({
            userId: userId,
            betAmount: betAmount,
            gridState: this.generateRandomGrid(),
            lastSpinResult: new Map(),
            manekiNekoFeature: { isActive: false }
        });

        // Calculate wins

        const winResults = SlotGameController.calculateWins(gameState.gridState);
        // Convert winResults to a Map or adjust according to schema
        const lastSpinResult = new Map();
        winResults.forEach(win => {
            lastSpinResult.set(win.line, win.payout);
        });
        gameState.lastSpinResult = lastSpinResult;

        // Check for special features
        if (this.checkForManekiNeko(gameState.gridState)) {
            gameState.manekiNekoFeature.isActive = true;
            // Implement logic for Maneki-neko feature
        }

        // Update player's balance 
        if (winResults.length > 0) {
            const totalPayout = winResults.reduce((total, win) => total + win.payout, 0);
            player.walletBalance += totalPayout;
            updateUserWinnings(player, betAmount);
        }

        await player.save();
        await gameState.save();

        // Emit updated user data
        const updatedUserData = {
            walletBalance: player.walletBalance,
            xp: player.xp,
            level: player.level,
        };

        io.to(userId.toString()).emit('userDataUpdated', updatedUserData);

        return gameState;
    }

    static generateRandomGrid() {
        const symbols = ['red', 'blue', 'green', 'yin_yang', 'hakkero', 'yellow', 'wild'];
        let grid = [];
        for (let i = 0; i < 9; i++) {
            grid.push(symbols[Math.floor(Math.random() * symbols.length)]);
        }
        return grid;
    }

    static calculateWins(grid) {
        const symbolPayouts = {
            red: 3,
            blue: 5,
            green: 8,
            yin_yang: 10,
            hakkero: 25,
            yellow: 100,
            wild: 250
        };

        let wins = [];

        // Helper function to calculate payout for a line
        const calculateLinePayout = (line) => {
            if (line.every(symbol => symbol === line[0] || symbol === 'wild')) {
                const mainSymbol = line[0] === 'wild' && line[1] !== 'wild' ? line[1] : line[0];
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
        for (let i = 0; i < 3; i++) {
            const line = [grid[i], grid[i + 3], grid[i + 6]];
            const payout = calculateLinePayout(line);
            if (payout > 0) wins.push({ line: `Vertical ${i + 1}`, payout });
        }

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
