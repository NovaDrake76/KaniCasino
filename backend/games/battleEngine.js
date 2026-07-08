const Battle = require("../models/Battle");
const Case = require("../models/Case");
const User = require("../models/User");
const { getWinningItem, addUniqueInfoToItem } = require("../utils/caseOpening");
const { chargeUser, creditUser, awardXp } = require("../utils/economy");
const { modeConfig, evaluateWinner, splitItemsEvenly } = require("../utils/battle");

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

// atomically claim the battle (status waiting -> in_progress) so two concurrent
// battle:start calls can never both charge/preroll/reveal. charge all-or-nothing,
// preroll, then award xp. returns { ok: true } or { error, shortSlot? }.
async function chargeAndStart(battleId, io = noopIo) {
  // compare-and-set on status: only one caller wins this transition
  const battle = await Battle.findOneAndUpdate(
    { _id: battleId, status: "waiting" },
    { $set: { status: "in_progress", startedAt: new Date(), currentRound: 0 } },
    { new: true }
  );
  if (!battle) return { error: "Battle not available" };

  // release the claim so a legitimate retry can start once the problem is fixed
  const release = () => Battle.updateOne({ _id: battleId }, { $set: { status: "waiting" } });

  const config = modeConfig(battle.mode);
  if (!config || battle.players.length !== config.slots) {
    await release();
    return { error: "All slots must be filled to start" };
  }

  // defense-in-depth: refuse a corrupted roster (duplicate slot or duplicate human)
  const slotSet = new Set(battle.players.map((p) => p.slot));
  const humanIds = battle.players.filter((p) => p.userId).map((p) => p.userId.toString());
  if (slotSet.size !== config.slots || new Set(humanIds).size !== humanIds.length) {
    await release();
    return { error: "Battle roster invalid" };
  }

  const humans = battle.players.filter((p) => p.userId && !p.isBot);

  // pre-check balances so we don't do partial charges in the common case
  for (const p of humans) {
    const u = await User.findById(p.userId).select("walletBalance");
    if (!u || u.walletBalance < battle.entryCost) {
      await release();
      return { error: `${p.username} can't cover the entry`, shortSlot: p.slot };
    }
  }

  // charge all-or-nothing (wallet only; xp is granted after the start commits so
  // a refund never has to reverse it). refund + release if any charge loses a race
  const charged = [];
  for (const p of humans) {
    const updated = await chargeUser(p.userId, battle.entryCost, { awardXp: false });
    if (!updated) {
      for (const id of charged) {
        const refunded = await creditUser(id, battle.entryCost, 0);
        emitUserData(io, id, refunded);
      }
      await release();
      return { error: "A player could not pay; battle cancelled" };
    }
    charged.push(p.userId);
  }

  battle.rolls = await prerollBattle(battle);
  await battle.save();

  // now that the start is committed, grant xp like a normal case open
  for (const id of charged) {
    const leveled = await awardXp(id, battle.entryCost * 5);
    emitUserData(io, id, leveled);
  }
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

// pay the winning team and finish. claims the finish atomically so the item
// payout runs exactly once, then applies any not-yet-revealed rounds (so it also
// safely completes a battle a restart left mid-flight).
async function finishBattle(battle, io = noopIo) {
  // compare-and-set on status: only one runner pays out this battle
  const claimed = await Battle.findOneAndUpdate(
    { _id: battle._id, status: "in_progress" },
    { $set: { status: "finished", finishedAt: new Date() } },
    { new: true }
  );
  if (!claimed) return Battle.findById(battle._id); // already finished elsewhere

  for (let r = claimed.currentRound; r < claimed.cases.length; r++) {
    const round = claimed.rolls[r] || [];
    claimed.players.forEach((p) => {
      const item = round[p.slot];
      if (item) {
        p.items.push(item);
        p.total += item.baseValue || 0;
      }
    });
    claimed.currentRound = r + 1;
  }

  const { winningTeam, tiedTeams } = evaluateWinner(claimed.players, claimed.bakaMode);
  const winners = claimed.players.filter((p) => p.team === winningTeam);
  const pool = claimed.players.flatMap((p) => p.items);
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

  claimed.winnerUserIds = winnerUserIds;
  claimed.winningTeam = winningTeam;
  claimed.tiedTeams = tiedTeams.length > 1 ? tiedTeams : [];
  await claimed.save();
  return claimed;
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
