const { v4: uuidv4 } = require("uuid");
const Case = require("../models/Case");
const User = require("../models/User");
const { getWinningItem, addUniqueInfoToItem } = require("../utils/caseOpening");
const { chargeUser, creditUser } = require("../utils/economy");

const PUBLIC_FIELDS = "username profilePicture level";
const MAX_PLAYERS_LIMIT = 4;
const MIN_PLAYERS = 2;

const itemBattle = (io) => {
  const battles = {}; // id -> battle (in memory; no funds are held while waiting)

  const publicBattle = (b) => ({
    id: b.id,
    caseId: b.caseId,
    caseImage: b.caseImage,
    caseTitle: b.caseTitle,
    price: b.price,
    maxPlayers: b.maxPlayers,
    status: b.status,
    winnerId: b.winnerId || null,
    players: b.players.map((p) => ({
      id: p.id,
      username: p.username,
      profilePicture: p.profilePicture,
      level: p.level,
      items: p.items,
      score: p.score,
    })),
  });

  const waitingList = () =>
    Object.values(battles)
      .filter((b) => b.status === "waiting")
      .map(publicBattle);

  const broadcastList = () => io.emit("battle:list", waitingList());
  const broadcastBattle = (b) => io.emit("battle:updated", publicBattle(b));

  const resolveBattle = async (battle) => {
    battle.status = "starting";

    // charge every player at start, so no funds are ever held while waiting.
    // if anyone can't pay, refund the players already charged and cancel.
    const charged = [];
    let failed = false;
    for (const player of battle.players) {
      const updated = await chargeUser(player.id, battle.price, { awardXp: false });
      if (!updated) {
        failed = true;
        break;
      }
      charged.push(player.id);
      io.to(player.id.toString()).emit("userDataUpdated", {
        walletBalance: updated.walletBalance,
        xp: updated.xp,
        level: updated.level,
      });
    }

    if (failed) {
      for (const id of charged) {
        const refunded = await creditUser(id, battle.price, 0);
        io.to(id.toString()).emit("userDataUpdated", {
          walletBalance: refunded.walletBalance,
          xp: refunded.xp,
          level: refunded.level,
        });
      }
      battle.status = "cancelled";
      broadcastBattle(battle);
      broadcastList();
      delete battles[battle.id];
      return;
    }

    // open the case once for each player and score by total rarity
    for (const player of battle.players) {
      const won = addUniqueInfoToItem(getWinningItem(battle.caseData));
      player.items = [won];
      player.score = Number(won.rarity) || 0;
    }

    const topScore = Math.max(...battle.players.map((p) => p.score));
    const contenders = battle.players.filter((p) => p.score === topScore);
    const winner = contenders[Math.floor(Math.random() * contenders.length)];
    battle.winnerId = winner.id;
    battle.status = "finished";

    // the winner takes every item opened in the battle
    const allItems = battle.players.flatMap((p) => p.items);
    await User.updateOne(
      { _id: winner.id },
      { $push: { inventory: { $each: allItems } } }
    );

    broadcastBattle(battle);
    broadcastList();

    // forget the finished battle after a while so the list doesn't grow
    setTimeout(() => {
      delete battles[battle.id];
    }, 60000);
  };

  io.on("connection", (socket) => {
    socket.on("battle:list", (callback) => {
      if (typeof callback === "function") callback(waitingList());
    });

    socket.on("battle:get", (battleId, callback) => {
      const battle = battles[battleId];
      if (typeof callback === "function") {
        callback(battle ? publicBattle(battle) : null);
      }
    });

    socket.on("battle:create", async ({ caseId, maxPlayers } = {}, callback) => {
      try {
        const userId = socket.userId;
        if (!userId) {
          if (typeof callback === "function") callback({ error: "Not authenticated" });
          return;
        }

        const players = Math.min(Math.max(parseInt(maxPlayers, 10) || 0, MIN_PLAYERS), MAX_PLAYERS_LIMIT);

        const caseData = await Case.findById(caseId).populate("items");
        if (!caseData || !caseData.items || caseData.items.length === 0) {
          if (typeof callback === "function") callback({ error: "Case not found" });
          return;
        }

        const user = await User.findById(userId).select(PUBLIC_FIELDS + " walletBalance");
        if (!user) {
          if (typeof callback === "function") callback({ error: "User not found" });
          return;
        }
        if (user.walletBalance < caseData.price) {
          if (typeof callback === "function") callback({ error: "Insufficient balance" });
          return;
        }

        const id = uuidv4();
        battles[id] = {
          id,
          caseId: caseData._id.toString(),
          caseData,
          caseImage: caseData.image,
          caseTitle: caseData.title,
          price: caseData.price,
          maxPlayers: players,
          status: "waiting",
          winnerId: null,
          players: [
            {
              id: userId.toString(),
              username: user.username,
              profilePicture: user.profilePicture,
              level: user.level,
              items: [],
              score: 0,
            },
          ],
        };

        broadcastList();
        broadcastBattle(battles[id]);
        if (typeof callback === "function") callback({ id });
      } catch (err) {
        console.log(err);
        if (typeof callback === "function") callback({ error: "Server error" });
      }
    });

    socket.on("battle:join", async (battleId, callback) => {
      try {
        const userId = socket.userId;
        if (!userId) {
          if (typeof callback === "function") callback({ error: "Not authenticated" });
          return;
        }

        const battle = battles[battleId];
        if (!battle || battle.status !== "waiting") {
          if (typeof callback === "function") callback({ error: "Battle not available" });
          return;
        }
        if (battle.players.some((p) => p.id === userId.toString())) {
          if (typeof callback === "function") callback({ error: "Already joined" });
          return;
        }
        if (battle.players.length >= battle.maxPlayers) {
          if (typeof callback === "function") callback({ error: "Battle is full" });
          return;
        }

        const user = await User.findById(userId).select(PUBLIC_FIELDS + " walletBalance");
        if (!user) {
          if (typeof callback === "function") callback({ error: "User not found" });
          return;
        }
        if (user.walletBalance < battle.price) {
          if (typeof callback === "function") callback({ error: "Insufficient balance" });
          return;
        }

        // re-check after the await to avoid overfilling on concurrent joins
        if (
          battle.status !== "waiting" ||
          battle.players.length >= battle.maxPlayers ||
          battle.players.some((p) => p.id === userId.toString())
        ) {
          if (typeof callback === "function") callback({ error: "Battle not available" });
          return;
        }

        battle.players.push({
          id: userId.toString(),
          username: user.username,
          profilePicture: user.profilePicture,
          level: user.level,
          items: [],
          score: 0,
        });

        if (typeof callback === "function") callback({ id: battle.id });

        if (battle.players.length >= battle.maxPlayers) {
          await resolveBattle(battle);
        } else {
          broadcastList();
          broadcastBattle(battle);
        }
      } catch (err) {
        console.log(err);
        if (typeof callback === "function") callback({ error: "Server error" });
      }
    });

    socket.on("battle:leave", (battleId) => {
      const userId = socket.userId;
      const battle = battles[battleId];
      if (!userId || !battle || battle.status !== "waiting") return;

      battle.players = battle.players.filter((p) => p.id !== userId.toString());

      if (battle.players.length === 0) {
        delete battles[battleId];
      } else {
        broadcastBattle(battle);
      }
      broadcastList();
    });
  });
};

module.exports = itemBattle;
