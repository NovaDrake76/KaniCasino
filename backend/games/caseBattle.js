const Battle = require("../models/Battle");
const Case = require("../models/Case");
const User = require("../models/User");
const { modeConfig } = require("../utils/battle");
const engine = require("./battleEngine");

const REVEAL_MS = 4500; // time the client spends animating each case round
const LEAD_MS = 1500; // pause before the first case opens
const MAX_CASES = 20;
const PUBLIC_USER = "username profilePicture";

const room = (id) => `battle:${id}`;

const BOT_NAMES = ["Chaz Bot", "MamBot", "Carlos Bot"];

const isHost = (b, userId) =>
  userId && b.createdBy && b.createdBy.toString() === userId.toString();

const nextFreeSlot = (b, config) => {
  const taken = new Set(b.players.map((p) => p.slot));
  for (let i = 0; i < config.slots; i++) if (!taken.has(i)) return i;
  return -1;
};

const publicPlayers = (b) =>
  b.players.map((p) => ({
    userId: p.userId || null,
    username: p.username,
    profilePicture: p.profilePicture,
    team: p.team,
    slot: p.slot,
    isBot: p.isBot,
    items: p.items,
    total: p.total,
  }));

const publicBattle = (b) => ({
  id: b._id,
  status: b.status,
  mode: b.mode,
  bakaMode: b.bakaMode,
  cases: b.cases,
  entryCost: b.entryCost,
  createdBy: b.createdBy,
  currentRound: b.currentRound,
  winnerUserIds: b.winnerUserIds || [],
  winningTeam: b.winningTeam ?? null,
  tiedTeams: b.tiedTeams || [],
  players: publicPlayers(b),
});

const caseBattle = (io) => {
  const broadcastBattle = (b) => io.to(room(b._id)).emit("battle:state", publicBattle(b));
  const broadcastList = async () => {
    const waiting = await Battle.find({ status: "waiting" }).sort({ createdAt: -1 }).limit(50);
    io.emit("battle:list", waiting.map(publicBattle));
  };

  // reveal each case round on a timer, then finish + pay out
  const runReveal = (battleId) => {
    const playRound = async (roundIndex) => {
      try {
        const b = await Battle.findById(battleId);
        if (!b || b.status !== "in_progress") return;
        await engine.applyRound(b, roundIndex);
        io.to(room(battleId)).emit("battle:round", { battleId: String(battleId), round: roundIndex, players: publicPlayers(b) });
        if (roundIndex + 1 < b.cases.length) {
          setTimeout(() => playRound(roundIndex + 1), REVEAL_MS);
        } else {
          const done = await engine.finishBattle(b, io);
          io.to(room(battleId)).emit("battle:finished", publicBattle(done));
          broadcastList();
        }
      } catch (e) {
        console.log(e);
      }
    };
    setTimeout(() => playRound(0), LEAD_MS);
  };

  // finish anything a restart left mid-flight
  engine.completeStuckBattles(io).catch((e) => console.log(e));

  io.on("connection", (socket) => {
    socket.on("battle:list", async (cb) => {
      try {
        const waiting = await Battle.find({ status: "waiting" }).sort({ createdAt: -1 }).limit(50);
        if (typeof cb === "function") cb(waiting.map(publicBattle));
      } catch (e) {
        if (typeof cb === "function") cb([]);
      }
    });

    socket.on("battle:get", async (battleId, cb) => {
      try {
        const b = await Battle.findById(battleId);
        if (!b) return cb && cb(null);
        socket.join(room(b._id)); // follow / spectate
        if (typeof cb === "function") cb(publicBattle(b));
      } catch (e) {
        if (typeof cb === "function") cb(null);
      }
    });

    socket.on("battle:create", async ({ caseIds, mode, bakaMode } = {}, cb) => {
      try {
        const userId = socket.userId;
        if (!userId) return cb && cb({ error: "Not authenticated" });

        const config = modeConfig(mode);
        if (!config) return cb && cb({ error: "Invalid mode" });
        if (!Array.isArray(caseIds) || !caseIds.length || caseIds.length > MAX_CASES) {
          return cb && cb({ error: "Pick between 1 and 20 cases" });
        }

        const cases = await Case.find({ _id: { $in: caseIds } });
        const byId = new Map(cases.map((c) => [c._id.toString(), c]));
        const ordered = caseIds.map((id) => byId.get(String(id))).filter(Boolean);
        if (ordered.length !== caseIds.length) return cb && cb({ error: "A selected case was not found" });
        const entryCost = ordered.reduce((s, c) => s + (c.price || 0), 0);

        const user = await User.findById(userId).select(PUBLIC_USER + " walletBalance");
        if (!user) return cb && cb({ error: "User not found" });
        if (user.walletBalance < entryCost) return cb && cb({ error: "Insufficient balance to create" });

        const battle = await Battle.create({
          mode,
          bakaMode: !!bakaMode,
          cases: caseIds,
          entryCost,
          createdBy: userId,
          players: [
            {
              userId,
              username: user.username,
              profilePicture: user.profilePicture,
              team: config.teams[0],
              slot: 0,
              isBot: false,
            },
          ],
        });

        socket.join(room(battle._id));
        broadcastList();
        broadcastBattle(battle);
        if (typeof cb === "function") cb({ id: battle._id });
      } catch (e) {
        console.log(e);
        if (typeof cb === "function") cb({ error: "Server error" });
      }
    });

    socket.on("battle:join", async (battleId, cb) => {
      try {
        const userId = socket.userId;
        if (!userId) return cb && cb({ error: "Not authenticated" });

        const b = await Battle.findById(battleId);
        if (!b || b.status !== "waiting") return cb && cb({ error: "Battle not available" });
        const config = modeConfig(b.mode);
        if (b.players.some((p) => p.userId && p.userId.toString() === userId.toString())) {
          return cb && cb({ error: "You are already in this battle" });
        }
        if (b.players.length >= config.slots) return cb && cb({ error: "Battle is full" });

        const user = await User.findById(userId).select(PUBLIC_USER + " walletBalance");
        if (!user) return cb && cb({ error: "User not found" });
        if (user.walletBalance < b.entryCost) {
          return cb && cb({ error: `You need K₽${b.entryCost} to join` });
        }

        const slot = nextFreeSlot(b, config);
        if (slot === -1) return cb && cb({ error: "Battle is full" });

        // atomically claim the seat: the filter rejects the join if the battle
        // left "waiting", this user is already in, the slot got taken, or it
        // filled up — closing the concurrent-join / post-start-injection races
        const updated = await Battle.findOneAndUpdate(
          {
            _id: battleId,
            status: "waiting",
            "players.userId": { $ne: userId },
            "players.slot": { $ne: slot },
            $expr: { $lt: [{ $size: "$players" }, config.slots] },
          },
          {
            $push: {
              players: {
                userId,
                username: user.username,
                profilePicture: user.profilePicture,
                team: config.teams[slot],
                slot,
                isBot: false,
              },
            },
          },
          { new: true }
        );
        if (!updated) return cb && cb({ error: "Battle changed, please retry" });

        socket.join(room(updated._id));
        broadcastList();
        broadcastBattle(updated);
        if (typeof cb === "function") cb({ id: updated._id });
      } catch (e) {
        console.log(e);
        if (typeof cb === "function") cb({ error: "Server error" });
      }
    });

    socket.on("battle:addBot", async (battleId, cb) => {
      try {
        const b = await Battle.findById(battleId);
        if (!b || b.status !== "waiting") return cb && cb({ error: "Battle not available" });
        if (!isHost(b, socket.userId)) return cb && cb({ error: "Only the host can add bots" });

        const config = modeConfig(b.mode);
        const slot = nextFreeSlot(b, config);
        if (slot === -1) return cb && cb({ error: "Battle is full" });

        const usedNames = new Set(b.players.filter((p) => p.isBot).map((p) => p.username));
        const botName = BOT_NAMES.find((n) => !usedNames.has(n)) || `Bot ${slot + 1}`;

        // atomic seat claim (host-gated), same race guards as join
        const updated = await Battle.findOneAndUpdate(
          {
            _id: battleId,
            status: "waiting",
            createdBy: socket.userId,
            "players.slot": { $ne: slot },
            $expr: { $lt: [{ $size: "$players" }, config.slots] },
          },
          {
            $push: {
              players: {
                userId: null,
                username: botName,
                profilePicture: "",
                team: config.teams[slot],
                slot,
                isBot: true,
              },
            },
          },
          { new: true }
        );
        if (!updated) return cb && cb({ error: "Battle changed, please retry" });
        broadcastList();
        broadcastBattle(updated);
        if (typeof cb === "function") cb({ ok: true });
      } catch (e) {
        console.log(e);
        if (typeof cb === "function") cb({ error: "Server error" });
      }
    });

    socket.on("battle:kick", async (battleId, slot, cb) => {
      try {
        // coerce the client slot to a positive integer (never trust it in a query)
        const s = Number(slot);
        if (!Number.isInteger(s) || s <= 0) return cb && cb({ error: "Invalid slot" });

        const b = await Battle.findById(battleId);
        if (!b || b.status !== "waiting") return cb && cb({ error: "Battle not available" });
        if (!isHost(b, socket.userId)) return cb && cb({ error: "Only the host can kick" });

        // atomic removal, guarded on waiting+host so a concurrent start can't be
        // clobbered (removing a player from an already-charged roster)
        const updated = await Battle.findOneAndUpdate(
          { _id: battleId, status: "waiting", createdBy: socket.userId },
          { $pull: { players: { slot: s } } },
          { new: true }
        );
        if (!updated) return cb && cb({ error: "Battle not available" });
        broadcastList();
        broadcastBattle(updated);
        if (typeof cb === "function") cb({ ok: true });
      } catch (e) {
        console.log(e);
        if (typeof cb === "function") cb({ error: "Server error" });
      }
    });

    socket.on("battle:leave", async (battleId) => {
      try {
        const userId = socket.userId;
        const b = await Battle.findById(battleId);
        if (!userId || !b || b.status !== "waiting") return;

        if (isHost(b, userId)) {
          // CAS: only cancel while still waiting; a concurrent start wins otherwise
          const cancelled = await Battle.findOneAndUpdate(
            { _id: battleId, status: "waiting", createdBy: userId },
            { $set: { status: "cancelled" } },
            { new: true }
          );
          if (!cancelled) return; // start already claimed it -> let it run/pay out
          io.to(room(cancelled._id)).emit("battle:state", publicBattle(cancelled));
        } else {
          const updated = await Battle.findOneAndUpdate(
            { _id: battleId, status: "waiting" },
            { $pull: { players: { userId } } },
            { new: true }
          );
          if (!updated) return;
          broadcastBattle(updated);
        }
        broadcastList();
      } catch (e) {
        console.log(e);
      }
    });

    socket.on("battle:start", async (battleId, cb) => {
      try {
        const b = await Battle.findById(battleId);
        if (!b || b.status !== "waiting") return cb && cb({ error: "Battle not available" });
        if (!isHost(b, socket.userId)) return cb && cb({ error: "Only the host can start" });

        const result = await engine.chargeAndStart(battleId, io);
        if (result.error) return cb && cb(result);

        const started = await Battle.findById(battleId);
        broadcastList();
        io.to(room(battleId)).emit("battle:state", publicBattle(started));
        runReveal(battleId);
        if (typeof cb === "function") cb({ ok: true });
      } catch (e) {
        console.log(e);
        if (typeof cb === "function") cb({ error: "Server error" });
      }
    });
  });
};

module.exports = caseBattle;
