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
        io.to(room(battleId)).emit("battle:round", { round: roundIndex, players: publicPlayers(b) });
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

        b.players.push({
          userId,
          username: user.username,
          profilePicture: user.profilePicture,
          team: config.teams[slot],
          slot,
          isBot: false,
        });
        await b.save();

        socket.join(room(b._id));
        broadcastList();
        broadcastBattle(b);
        if (typeof cb === "function") cb({ id: b._id });
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

        b.players.push({
          userId: null,
          username: `Bot ${slot + 1}`,
          profilePicture: "",
          team: config.teams[slot],
          slot,
          isBot: true,
        });
        await b.save();
        broadcastList();
        broadcastBattle(b);
        if (typeof cb === "function") cb({ ok: true });
      } catch (e) {
        console.log(e);
        if (typeof cb === "function") cb({ error: "Server error" });
      }
    });

    socket.on("battle:kick", async (battleId, slot, cb) => {
      try {
        const b = await Battle.findById(battleId);
        if (!b || b.status !== "waiting") return cb && cb({ error: "Battle not available" });
        if (!isHost(b, socket.userId)) return cb && cb({ error: "Only the host can kick" });
        if (slot === 0) return cb && cb({ error: "Can't remove the host" });

        b.players = b.players.filter((p) => p.slot !== slot);
        await b.save();
        broadcastList();
        broadcastBattle(b);
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
          b.status = "cancelled";
          await b.save();
          io.to(room(b._id)).emit("battle:state", publicBattle(b));
        } else {
          b.players = b.players.filter((p) => !(p.userId && p.userId.toString() === userId.toString()));
          await b.save();
          broadcastBattle(b);
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
