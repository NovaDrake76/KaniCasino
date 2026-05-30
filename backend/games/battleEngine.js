const Battle = require("../models/Battle");
const Case = require("../models/Case");
const User = require("../models/User");
const { getWinningItem, addUniqueInfoToItem } = require("../utils/caseOpening");
const { chargeUser, creditUser } = require("../utils/economy");
const { modeConfig, pickWinningTeam, splitItemsEvenly } = require("../utils/battle");

const noopIo = { to: () => ({ emit: () => {} }), emit: () => {} };

const emitUserData = (io, userId, user) => {
  io.to(userId.toString()).emit("userDataUpdated", {
    walletBalance: user.walletBalance,
    xp: user.xp,
    level: user.level,
  });
};

// roll every outcome up front so the battle is deterministic once started
// (survives restarts, lets spectators/rejoiners see the same thing).
async function prerollBattle(battle) {
  const config = modeConfig(battle.mode);
  const rolls = [];
  for (const caseId of battle.cases) {
    const caseDoc = await Case.findById(caseId).populate("items");
    const round = [];
    for (let slot = 0; slot < config.slots; slot++) {
      round.push(addUniqueInfoToItem(getWinningItem(caseDoc)));
    }
    rolls.push(round);
  }
  return rolls;
}

// re-check balances, charge every human all-or-nothing, preroll, mark in_progress.
// returns { ok: true } or { error, shortSlot? }.
async function chargeAndStart(battleId, io = noopIo) {
  const battle = await Battle.findById(battleId);
  if (!battle || battle.status !== "waiting") return { error: "Battle not available" };

  const config = modeConfig(battle.mode);
  if (!config || battle.players.length !== config.slots) {
    return { error: "All slots must be filled to start" };
  }

  const humans = battle.players.filter((p) => p.userId && !p.isBot);

  // pre-check balances so we don't do partial charges in the common case
  for (const p of humans) {
    const u = await User.findById(p.userId).select("walletBalance");
    if (!u || u.walletBalance < battle.entryCost) {
      return { error: `${p.username} can't cover the entry`, shortSlot: p.slot };
    }
  }

  // charge all-or-nothing (refund anyone charged if a later charge loses a race)
  const charged = [];
  for (const p of humans) {
    const updated = await chargeUser(p.userId, battle.entryCost, { awardXp: false });
    if (!updated) {
      for (const id of charged) {
        const refunded = await creditUser(id, battle.entryCost, 0);
        emitUserData(io, id, refunded);
      }
      return { error: "A player could not pay; battle cancelled" };
    }
    charged.push(p.userId);
    emitUserData(io, p.userId, updated);
  }

  battle.rolls = await prerollBattle(battle);
  battle.status = "in_progress";
  battle.startedAt = new Date();
  battle.currentRound = 0;
  await battle.save();
  return { ok: true };
}

// apply one case round's rolls to the players, persist
async function applyRound(battle, roundIndex) {
  const round = battle.rolls[roundIndex] || [];
  battle.players.forEach((p) => {
    const item = round[p.slot];
    if (item) {
      p.items.push(item);
      p.total += item.baseValue || 0;
    }
  });
  battle.currentRound = roundIndex + 1;
  await battle.save();
}

// pay the winning team and finish. applies any not-yet-revealed rounds first,
// so it also safely completes a battle a restart left mid-flight.
async function finishBattle(battle, io = noopIo) {
  for (let r = battle.currentRound; r < battle.cases.length; r++) {
    const round = battle.rolls[r] || [];
    battle.players.forEach((p) => {
      const item = round[p.slot];
      if (item) {
        p.items.push(item);
        p.total += item.baseValue || 0;
      }
    });
    battle.currentRound = r + 1;
  }

  const winningTeam = pickWinningTeam(battle.players, battle.bakaMode);
  const winners = battle.players.filter((p) => p.team === winningTeam);
  const pool = battle.players.flatMap((p) => p.items);
  const shares = splitItemsEvenly(pool, winners.length);

  const winnerUserIds = [];
  for (let i = 0; i < winners.length; i++) {
    const w = winners[i];
    if (!w.userId) continue; // a bot's share sinks to the house
    winnerUserIds.push(w.userId);
    const invItems = (shares[i] || []).map((it) => ({
      _id: it._id,
      name: it.name,
      image: it.image,
      rarity: it.rarity,
      case: it.case,
      createdAt: new Date(),
      uniqueId: it.uniqueId,
    }));
    if (invItems.length) {
      await User.updateOne({ _id: w.userId }, { $push: { inventory: { $each: invItems } } });
    }
  }

  battle.winnerUserIds = winnerUserIds;
  battle.status = "finished";
  battle.finishedAt = new Date();
  await battle.save();
  return battle;
}

// on boot, finish any battle a restart interrupted so none are stuck
async function completeStuckBattles(io = noopIo) {
  const stuck = await Battle.find({ status: "in_progress" });
  for (const b of stuck) {
    try {
      await finishBattle(b, io);
    } catch (e) {
      console.log(e);
    }
  }
  return stuck.length;
}

module.exports = { prerollBattle, chargeAndStart, applyRound, finishBattle, completeStuckBattles };
