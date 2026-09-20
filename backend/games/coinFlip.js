const Round = require("../models/Round");
const { chargeUser, creditUser, TX } = require("../utils/economy");
const { coinResultFromSeed, PURPLE_CHANCE, PURPLE_RESULT } = require("../utils/coinMath");
const { consumeNextSeed } = require("../utils/gameChain");
const { sha256 } = require("../utils/hashChain");
const liveFeed = require("../utils/liveFeed");

// a fair coin paying 2x is a 0% house edge: the house cannot win, and the game is a
// pure variance pump on the KP supply that no amount of play ever drains. paying
// 1.94x puts it at 3%, in the same band as crash (3.97%) and slots (3.55%).
// floor keeps the payout in whole KP and always rounds towards the house, so there is
// no bet size that rounds its way into a player edge.
const COINFLIP_RTP = 0.97;
const winPayout = (bet) => Math.floor(bet * 2 * COINFLIP_RTP);

// version 2 adds a purple side that lands PURPLE_CHANCE of the time and carries the whole edge,
// like the green on a roulette wheel: heads and tails pay a flat 2x (a 97% return at 48.5%),
// purple pays this (a 96% return at 3%). opened by COINFLIP_PURPLE=1, read when a round opens
const PURPLE_MULTIPLIER = 32;
const SIDES = ["heads", "tails", "purple"];
const sideOf = (result) => SIDES[result];
const purpleOn = () => process.env.COINFLIP_PURPLE === "1";
const payoutFor = (bet, side, version = 1) => {
  if (version < 2) return winPayout(bet);
  return Math.floor(bet * (side === "purple" ? PURPLE_MULTIPLIER : 2));
};

// a table minimum, for the reason real tables have one: the payout is whole KP, and no
// integer pays 3% on a 1 KP stake (1 is 50%, 2 is 0%), so below a floor the rounding is
// the edge. at 10 the worst case is 5% and by 50 it is exactly 3%.
const MIN_BET = 10;
const MAX_BET = 1000000;

const freshState = (version = 1) => ({
  heads: { players: {}, bets: {} },
  tails: { players: {}, bets: {} },
  purple: { players: {}, bets: {} },
  version,
  serverSeed: null, // the round's seed, secret until the flip is revealed
  serverSeedHash: null, // its commitment, public from betting open
  result: null, // decided by the seed at betting open, revealed with the flip
});

// the result stays off the wire until the flip. serverSeedHash is safe: it is a one-way
// commitment, and the result cannot be derived from it without the seed.
const publicCoinState = (state) => ({
  heads: state.heads,
  tails: state.tails,
  purple: state.purple,
  version: state.version,
  purpleOn: state.version >= 2,
  pays: state.version >= 2 ? { side: 2, purple: PURPLE_MULTIPLIER, purpleChance: PURPLE_CHANCE } : { side: 2 * COINFLIP_RTP },
  serverSeedHash: state.serverSeedHash,
});

// the timings are arguments so a test can run a whole round in milliseconds against a
// real database. faking the clock instead breaks the mongo driver's own timers.
const coinFlip = (io, { bettingMs = 14000, revealMs = 5000, retryMs = 2000, drainMs = 3000 } = {}) => {
  let gameState = freshState();
  // the persisted record of the round being played. bets refuse to open without one:
  // taking a stake we cannot account for later is the thing this exists to stop.
  let round = null;
  // bets are only accepted in the window between flips
  let bettingOpen = false;
  // players whose charge is still in flight, so a duplicate emit can't get through
  const pendingBets = new Set();
  // the round loop runs forever, so it needs a way out: without one a restart or a test
  // leaves it looping against a database that is no longer there
  let stopped = false;
  let nextRound = null;
  let reveal = null;
  // the reveal's payout run, so a shutdown can wait for it rather than settle alongside it
  let settling = null;

  io.on("connection", (socket) => {
    // a player arriving mid-round sees the bets already placed and whether the purple side is open
    socket.emit("coinFlip:gameState", publicCoinState(gameState));

    socket.on("coinFlip:bet", async (bet, choice, callback) => {
      // the client used to get no answer at all when a bet was refused
      const reply = (result) => {
        if (typeof callback === "function") callback(result);
      };

      try {
        const userId = socket.userId;
        if (!userId) return reply({ error: "You must be logged in to bet" });
        if (!bettingOpen || !round) return reply({ error: "Betting is closed for this round" });

        const sides = gameState.version >= 2 ? 3 : 2;
        if (!Number.isInteger(choice) || choice < 0 || choice >= sides) {
          return reply({ error: sides === 3 ? "Pick heads, tails or purple" : "Pick heads or tails" });
        }
        if (!Number.isInteger(bet) || bet < MIN_BET || bet > MAX_BET) {
          return reply({ error: `Bet between ${MIN_BET} and ${MAX_BET} KP` });
        }

        const side = sideOf(choice);

        // one bet per round, on a single side. pendingBets covers the window while
        // the charge is in flight: without it, two emits in the same tick both pass
        // this guard and the player ends up backing heads and tails at once
        if (SIDES.some((s) => gameState[s].bets[userId]) || pendingBets.has(userId)) {
          return reply({ error: "You already have a bet this round" });
        }

        // atomically take the stake from the real balance. roundId on the ledger row is
        // what lets a restart work out whose stake it still owes.
        const roundId = String(round._id);
        pendingBets.add(userId);
        let updatedUser;
        try {
          updatedUser = await chargeUser(userId, bet, {
            type: TX.COINFLIP_BET,
            meta: { bet, side, roundId },
          });
        } finally {
          pendingBets.delete(userId);
        }
        if (!updatedUser) return reply({ error: "Insufficient funds" });

        await Round.updateOne(
          { _id: round._id },
          {
            $push: {
              bets: { userId, username: updatedUser.username, amount: bet, side, payout: 0 },
            },
          }
        );

        gameState[side].bets[userId] = bet;
        gameState[side].players[userId] = {
          _id: updatedUser._id,
          username: updatedUser.username,
          profilePicture: updatedUser.profilePicture,
          level: updatedUser.level,
          fixedItem: updatedUser.fixedItem,
        };

        io.to(userId.toString()).emit("userDataUpdated", {
          walletBalance: updatedUser.walletBalance,
          xp: updatedUser.xp,
          level: updatedUser.level,
        });

        io.emit("coinFlip:gameState", publicCoinState(gameState));
        reply({ ok: true });
      } catch (err) {
        console.log(err);
        reply({ error: "Could not place the bet" });
      }
    });
  });

  const calculatePayout = async (result, running) => {
    const winningSide = sideOf(result);
    const roundId = running ? String(running._id) : null;

    for (const userId in gameState[winningSide].bets) {
      try {
        const betAmount = gameState[winningSide].bets[userId];
        const payout = payoutFor(betAmount, winningSide, gameState.version);
        const updatedUser = await creditUser(userId, payout, payout - betAmount, {
          type: TX.COINFLIP_WIN,
          meta: { betAmount, payout, side: winningSide, roundId },
        });
        if (!updatedUser) continue; // account no longer exists

        if (running) {
          await Round.updateOne(
            { _id: running._id, "bets.userId": userId },
            { $set: { "bets.$.payout": payout, "bets.$.settledAt": new Date() } }
          );
        }

        io.to(userId.toString()).emit("userDataUpdated", {
          walletBalance: updatedUser.walletBalance,
          xp: updatedUser.xp,
          level: updatedUser.level,
        });

        liveFeed.publish({ game: "coinflip", user: updatedUser, bet: betAmount, payout });
      } catch (err) {
        console.log(err);
      }
    }
  };

  // a round exists before a single stake is taken, so there is always something to
  // account against. if the record cannot be written, betting stays shut rather than
  // taking money the server would have no way to give back.
  const openBetting = async () => {
    if (stopped) return;
    gameState = freshState(purpleOn() ? 2 : 1);
    try {
      // the seed fixes the flip before any bet: players see its commitment now and the
      // seed at round end, so the result was decided in advance and cannot be steered
      const { seed, chainId, index } = await consumeNextSeed("coinflip");
      gameState.serverSeed = seed;
      gameState.serverSeedHash = sha256(seed);
      gameState.result = coinResultFromSeed(seed, gameState.version);
      round = await Round.create({
        game: "coinflip",
        status: "betting",
        serverSeed: seed,
        serverSeedHash: gameState.serverSeedHash,
        chainId,
        chainIndex: index,
        outcome: { result: gameState.result, winningSide: sideOf(gameState.result), version: gameState.version },
      });
      if (stopped) return;
      bettingOpen = true;
    } catch (e) {
      console.log("coinFlip: could not open a round", e);
      round = null;
      bettingOpen = false;
      if (!stopped) nextRound = setTimeout(openBetting, retryMs); // retry rather than stall for good
      return;
    }
    io.emit("coinFlip:gameState", publicCoinState(gameState));
    nextRound = setTimeout(runRound, bettingMs); // betting window before the flip
  };

  const runRound = async () => {
    if (stopped) return;
    bettingOpen = false;
    io.emit("coinFlip:start");

    // the result was fixed by the seed at betting open; running just marks it landed, so
    // a restart tells a flip that happened from one still in its betting window
    const result = gameState.result;
    const running = round;
    if (running) {
      await Round.updateOne(
        { _id: running._id },
        { $set: { status: "running", startedAt: new Date() } }
      ).catch((e) => console.log(e));
    }

    const settleFlip = async () => {
      io.emit("coinFlip:result", result);
      // the seed is revealed only now, so nobody could have known the flip early
      io.emit("coinFlip:reveal", {
        roundId: running ? String(running._id) : null,
        serverSeed: gameState.serverSeed,
        serverSeedHash: gameState.serverSeedHash,
        result,
      });

      await calculatePayout(result, running);

      if (running) {
        await Round.updateOne(
          { _id: running._id },
          { $set: { status: "settled", settledAt: new Date() } }
        ).catch((e) => console.log(e));
      }

      openBetting();
    };

    reveal = setTimeout(() => {
      if (stopped) return;
      settling = settleFlip().catch((e) => console.log(e));
    }, revealMs);
  };

  openBetting();

  // stops the loop cleanly, then waits for the money already moving. the caller settles the
  // round afterwards by reading the ledger, so a charge or a payout still in flight has to
  // have written its row first: otherwise the settle pays a winner the loop just paid.
  return async () => {
    stopped = true;
    bettingOpen = false;
    if (nextRound) clearTimeout(nextRound);
    if (reveal) clearTimeout(reveal);
    if (settling) await settling.catch(() => {});
    const until = Date.now() + drainMs;
    while (pendingBets.size && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 25));
    }
  };
};

module.exports = coinFlip;
// exposed for unit testing
module.exports.winPayout = winPayout;
module.exports.payoutFor = payoutFor;
module.exports.COINFLIP_RTP = COINFLIP_RTP;
module.exports.PURPLE_MULTIPLIER = PURPLE_MULTIPLIER;
module.exports.PURPLE_RESULT = PURPLE_RESULT;
module.exports.MIN_BET = MIN_BET;
