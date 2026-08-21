const User = require("../models/User");
const PokerTable = require("../models/PokerTable");
const PokerHand = require("../models/PokerHand");
const { recordTransaction, TX } = require("../utils/economy");
const { HOUSE } = require("../utils/accounts");
const { generateServerSeed, hashServerSeed } = require("../utils/provablyFair");
const { shuffle, deal, boardFor, POKER_ALGO_VERSION, cardName } = require("../utils/pokerCards");
const { evaluate, CATEGORY_NAME } = require("../utils/pokerEval");
const { settleHand } = require("../utils/pokerSettle");
const { atRiskAll } = require("../utils/pokerPool");
const {
  startHand,
  legalActions,
  applyAction,
  advanceStreet,
  handOver,
  normalizeButton,
  SEAT,
} = require("../utils/pokerBetting");
const { seatOf, chipsBySeat, cashOut, cashOutOptions, buyIn, stakeableFor, releaseSeat } = require("./pokerTable");

const noopIo = { to: () => ({ emit: () => {} }), emit: () => {} };

const ACTION_MS = 25000;
// how long a settlement lease is trusted before another boot may take the hand over
const LEASE_MS = 30000;
// a player who lets the clock run out this many times in a row is sat out
const AUTOFOLD_LIMIT = 3;
// a seat below one big blind cannot post, so it is stood up rather than dealt in
const MIN_TO_PLAY = 1;
const START_DELAY_MS = 3000;
// only a rare enough item is worth telling the whole site about
const TICKER_RARITY = 4;
const SETTLE_DELAY_MS = 4000;

const room = (tableId) => `poker:${tableId}`;

// buying in debits the wallet and cashing out credits it, so the navbar has to be told or
// it shows a stale balance until the next reload
async function pushBalance(io, userId) {
  const user = await User.findById(userId).select("walletBalance xp level").lean();
  if (!user) return;
  io.to(String(userId)).emit("userDataUpdated", {
    walletBalance: user.walletBalance,
    xp: user.xp,
    level: user.level,
  });
}
const inHand = (s) => ["active", "folded", "allin"].includes(s.status);

// ---------------------------------------------------------------------------
// redaction. THE ONLY function allowed to turn a table into something emitted.
// nothing else may send table state, and a test asserts it from three vantages.
// ---------------------------------------------------------------------------
function redactFor(table, userId) {
  const raw = table.toObject ? table.toObject() : table;
  const viewer = userId ? String(userId) : null;
  const showdown = raw.status === "showdown" || raw.status === "settling";
  const yourSeat = viewer
    ? (raw.seats || []).findIndex((s) => s.userId && String(s.userId) === viewer)
    : -1;

  return {
    yourSeat: yourSeat < 0 ? null : yourSeat,
    // the legal actions come from the engine, never from a second copy of the rules on
    // the client: the rail draws exactly what the server would accept
    legal:
      yourSeat >= 0 && raw.toAct === yourSeat && raw.status === "betting"
        ? legalActions(
            {
              seats: (raw.seats || []).map((s) => ({
                stack: s.stack,
                committed: s.committed,
                status: ["active", "folded", "allin"].includes(s.status) ? s.status : "out",
                hasActed: s.hasActed,
                canRaise: s.canRaise,
              })),
              currentBet: raw.currentBet,
              minRaise: raw.minRaise,
              toAct: raw.toAct,
            },
            yourSeat
          )
        : [],
    _id: raw._id,
    slug: raw.slug,
    name: raw.name,
    seatCount: raw.seatCount,
    smallBlind: raw.smallBlind,
    bigBlind: raw.bigBlind,
    minBuyIn: raw.minBuyIn,
    maxBuyIn: raw.maxBuyIn,
    handNumber: raw.handNumber,
    button: raw.button,
    status: raw.status,
    street: raw.street,
    board: raw.board || [],
    pots: raw.pots || [],
    currentBet: raw.currentBet,
    minRaise: raw.minRaise,
    toAct: raw.toAct,
    actionDeadline: raw.actionDeadline,
    actionSeq: raw.actionSeq,
    // the commitment is public before the deal; the seed itself only after the hand
    pfServerSeedHash: raw.pfServerSeedHash,
    pool: (raw.pool || []).map((e) => ({
      uniqueId: e.uniqueId,
      name: e.name,
      image: e.image,
      rarity: e.rarity,
      value: e.value,
      stakedBy: e.stakedBy,
    })),
    atRisk: atRiskAll(raw.pool || [], chipsBySeat(raw)).map((e) => ({
      uniqueId: e.uniqueId,
      name: e.name,
      image: e.image,
      rarity: e.rarity,
      value: e.value,
      stakedBy: e.stakedBy,
    })),
    seats: (raw.seats || []).map((s) => ({
      seat: s.seat,
      userId: s.userId,
      username: s.username,
      profilePicture: s.profilePicture,
      stack: s.stack,
      committed: s.committed,
      totalCommitted: s.totalCommitted,
      status: s.status,
      leaveAfterHand: s.leaveAfterHand,
      // your own cards always; anybody else's only at a showdown they reached
      holeCards:
        viewer && s.userId && String(s.userId) === viewer
          ? s.holeCards || []
          : showdown && s.status === "allin"
          ? s.holeCards || []
          : showdown && s.status === "active" && (s.holeCards || []).length
          ? s.holeCards
          : null,
      // the deck is never sent, in any form: every hole card falls out of it
    })),
  };
}

// every emit of table state goes through here, per viewer, because a broadcast cannot be
// redacted per socket
async function pushTable(io, table) {
  const sockets = await io.in(room(table._id)).fetchSockets();
  for (const socket of sockets) {
    socket.emit("poker:state", redactFor(table, socket.userId));
  }
}

// ---------------------------------------------------------------------------
// the hand
// ---------------------------------------------------------------------------

// the seats that can be dealt in: seated, with chips, not sitting out
const playable = (table) =>
  table.seats.filter((s) => s.userId && s.stack >= MIN_TO_PLAY && s.status !== "sittingout");

// every seated player's locked client seed, in seat order. no single player can steer a
// deal that is keyed by all of them.
const combinedClientSeed = (table) =>
  table.seats
    .filter((s) => s.userId)
    .map((s) => s.clientSeed || `seat:${s.seat}`)
    .join(":");

function timers() {
  const handles = new Map();
  return {
    set(key, ms, fn) {
      this.clear(key);
      const handle = setTimeout(fn, ms);
      if (handle.unref) handle.unref();
      handles.set(String(key), handle);
    },
    clear(key) {
      const handle = handles.get(String(key));
      if (handle) clearTimeout(handle);
      handles.delete(String(key));
    },
    clearAll() {
      for (const handle of handles.values()) clearTimeout(handle);
      handles.clear();
    },
  };
}

function makeEngine(io = noopIo) {
  const clocks = timers();

  // compare-and-set on actionSeq: two callers racing the same transition cannot both win
  async function commit(tableId, seq, update) {
    return PokerTable.findOneAndUpdate(
      { _id: tableId, actionSeq: seq },
      { ...update, $inc: { actionSeq: 1 } },
      { new: true }
    );
  }

  async function startIfReady(tableId) {
    const table = await PokerTable.findById(tableId);
    if (!table || table.status !== "idle") return null;
    if (playable(table).length < 2) return null;

    const serverSeed = generateServerSeed();
    const button = normalizeButton(
      table.seats.map((s) => ({ status: playable(table).includes(s) ? SEAT.ACTIVE : SEAT.OUT })),
      (table.button + 1) % table.seatCount
    );

    const state = startHand({
      seats: table.seats.map((s) => ({
        stack: s.stack,
        sittingIn: !!s.userId && s.stack >= MIN_TO_PLAY && s.status !== "sittingout",
      })),
      button,
      smallBlind: table.smallBlind,
      bigBlind: table.bigBlind,
    });

    const seatOrder = table.seats.map((_, i) => i);
    const deck = shuffle(serverSeed, combinedClientSeed(table), table.handNumber + 1);
    const dealt = deal(deck, seatOrder.length);

    const seats = table.seats.map((s, i) => ({
      ...(s.toObject ? s.toObject() : s),
      stack: state.seats[i].stack,
      committed: state.seats[i].committed,
      totalCommitted: state.seats[i].totalCommitted,
      status: state.seats[i].status === SEAT.OUT ? (s.userId ? "sitting" : "empty") : state.seats[i].status,
      hasActed: state.seats[i].hasActed,
      canRaise: state.seats[i].canRaise,
      holeCards: state.seats[i].status === SEAT.OUT ? [] : dealt.holes[i],
    }));

    const started = await commit(tableId, table.actionSeq, {
      $set: {
        status: "betting",
        street: "preflop",
        board: [],
        deck,
        seats,
        pots: [],
        handNumber: table.handNumber + 1,
        button,
        currentBet: state.currentBet,
        minRaise: state.minRaise,
        lastAggressor: null,
        toAct: state.toAct,
        actionDeadline: new Date(Date.now() + ACTION_MS),
        sawFlop: false,
        pfServerSeed: serverSeed,
        pfServerSeedHash: hashServerSeed(serverSeed),
        lastHandAt: new Date(),
      },
    });
    if (!started) return null;

    io.to(room(tableId)).emit("poker:handStart", {
      handNumber: started.handNumber,
      button,
      pfServerSeedHash: started.pfServerSeedHash,
    });
    await pushTable(io, started);
    armClock(started);
    return started;
  }

  // rebuild the pure betting state from the stored table, act on it, store it back
  function stateFrom(table) {
    return {
      street: table.street,
      seats: table.seats.map((s) => ({
        stack: s.stack,
        committed: s.committed,
        totalCommitted: s.totalCommitted,
        status: inHand(s) ? s.status : SEAT.OUT,
        hasActed: s.hasActed,
        canRaise: s.canRaise,
      })),
      currentBet: table.currentBet,
      minRaise: table.minRaise,
      bigBlind: table.bigBlind,
      lastAggressor: table.lastAggressor,
      toAct: table.toAct,
    };
  }

  const seatPatch = (state) => ({
    stack: state.seats.map((s) => s.stack),
    committed: state.seats.map((s) => s.committed),
    totalCommitted: state.seats.map((s) => s.totalCommitted),
    status: state.seats.map((s) => s.status),
    hasActed: state.seats.map((s) => s.hasActed),
    canRaise: state.seats.map((s) => s.canRaise),
  });

  function writeState(table, state) {
    const patch = {};
    state.seats.forEach((s, i) => {
      // an out seat keeps whatever the table said; only players in the hand are written
      if (!table.seats[i].userId) return;
      if (s.status !== SEAT.OUT) patch[`seats.${i}.status`] = s.status;
      patch[`seats.${i}.stack`] = s.stack;
      patch[`seats.${i}.committed`] = s.committed;
      patch[`seats.${i}.totalCommitted`] = s.totalCommitted;
      patch[`seats.${i}.hasActed`] = s.hasActed;
      patch[`seats.${i}.canRaise`] = s.canRaise;
    });
    patch.currentBet = state.currentBet;
    patch.minRaise = state.minRaise;
    patch.lastAggressor = state.lastAggressor;
    patch.toAct = state.toAct === undefined ? null : state.toAct;
    patch.street = state.street;
    patch.actionDeadline = state.toAct === null || state.toAct === undefined ? null : new Date(Date.now() + ACTION_MS);
    return patch;
  }

  function armClock(table) {
    clocks.clear(table._id);
    if (table.toAct === null || table.toAct === undefined) return;
    const seat = table.toAct;
    const seq = table.actionSeq;
    clocks.set(table._id, ACTION_MS + 500, () => {
      timeOut(table._id, seat, seq).catch((e) => console.error("poker clock:", e.message));
    });
  }

  // the clock does not care whether anybody is still connected: leaving to dodge a fold
  // has to cost the same as folding
  async function timeOut(tableId, seat, seq) {
    const table = await PokerTable.findById(tableId);
    if (!table || table.actionSeq !== seq || table.toAct !== seat) return;
    const free = table.currentBet - table.seats[seat].committed <= 0;
    await act(tableId, table.seats[seat].userId, free ? { type: "check" } : { type: "fold" }, true);
  }

  async function act(tableId, userId, action, auto = false) {
    const table = await PokerTable.findById(tableId);
    if (!table) return { error: "Table not found" };
    if (table.status !== "betting") return { error: "No hand in progress" };

    const seat = seatOf(table, userId);
    if (seat < 0) return { error: "You are not at this table" };
    if (table.toAct !== seat) return { error: "Not your turn" };

    const state = stateFrom(table);
    const res = applyAction(state, seat, action);
    if (res.error) return { error: res.error };

    const patch = writeState(table, state);
    if (auto) patch[`seats.${seat}.autoFolds`] = (table.seats[seat].autoFolds || 0) + 1;
    else patch[`seats.${seat}.autoFolds`] = 0;
    if (state.street === "flop" || table.sawFlop) patch.sawFlop = true;

    const saved = await commit(tableId, table.actionSeq, { $set: patch });
    if (!saved) return { error: "Try again" };

    io.to(room(tableId)).emit("poker:action", {
      seat,
      action: action.type,
      to: action.to || null,
      auto,
      username: table.seats[seat].username,
    });
    await pushTable(io, saved);

    if (saved.toAct === null || saved.toAct === undefined) await advance(tableId);
    else armClock(saved);
    return { ok: true };
  }

  // a street closed: deal the next one, run the board out, or settle
  async function advance(tableId) {
    const table = await PokerTable.findById(tableId);
    if (!table || table.status !== "betting") return;

    const state = stateFrom(table);
    if (handOver(state)) return settle(tableId);

    const { done } = advanceStreet(state, table.button);
    if (done) return settle(tableId);

    const dealt = deal(table.deck, table.seatCount);
    const board = boardFor(dealt, state.street);
    const patch = writeState(table, state);
    patch.board = board;
    if (state.street === "flop") patch.sawFlop = true;

    const saved = await commit(tableId, table.actionSeq, { $set: patch });
    if (!saved) return;

    io.to(room(tableId)).emit("poker:street", { street: saved.street, board: saved.board });
    await pushTable(io, saved);

    // everybody all-in: no more decisions, so run it straight to the next street
    if (saved.toAct === null || saved.toAct === undefined) {
      clocks.set(`${tableId}:runout`, 1200, () => advance(tableId).catch((e) => console.error(e.message)));
    } else {
      armClock(saved);
    }
  }

  async function settle(tableId) {
    // the lease stops two boots finishing the same hand
    const claimed = await PokerTable.findOneAndUpdate(
      {
        _id: tableId,
        status: "betting",
        $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(Date.now() - LEASE_MS) } }],
      },
      { $set: { status: "settling", lockedAt: new Date(), toAct: null, actionDeadline: null }, $inc: { actionSeq: 1 } },
      { new: true }
    );
    if (!claimed) return;

    const table = claimed;
    const startStacks = table.seats.map((s) => s.stack + s.totalCommitted);
    const state = stateFrom(table);
    const dealt = deal(table.deck, table.seatCount);

    // an all-in hand runs the whole board out even though nobody could act on it
    const reached = handOver(state) ? table.street : "showdown";
    const board = boardFor(dealt, reached);
    const holeCards = {};
    table.seats.forEach((s, i) => {
      if (inHand(s)) holeCards[i] = s.holeCards;
    });

    const result = settleHand({
      state,
      button: table.button,
      bigBlind: table.bigBlind,
      sawFlop: table.sawFlop,
      holeCards,
      board,
    });

    const patch = {};
    state.seats.forEach((s, i) => {
      if (!table.seats[i].userId) return;
      patch[`seats.${i}.stack`] = s.stack;
      patch[`seats.${i}.committed`] = 0;
      patch[`seats.${i}.totalCommitted`] = 0;
      patch[`seats.${i}.hasActed`] = false;
      patch[`seats.${i}.canRaise`] = true;
    });
    patch.status = "showdown";
    patch.board = board;
    patch.pots = result.pots;
    patch.toAct = null;
    patch.actionDeadline = null;
    patch.lockedAt = null;

    const shown = await PokerTable.findOneAndUpdate(
      { _id: tableId, actionSeq: table.actionSeq },
      { $set: patch, $inc: { actionSeq: 1 } },
      { new: true }
    );
    if (!shown) return;

    if (result.rake > 0) {
      // the house is the userId on its own rows, the same shape market_fee uses
      await recordTransaction({
        userId: HOUSE,
        type: TX.POKER_RAKE,
        direction: "credit",
        amount: result.rake,
        counterparty: null,
        meta: { tableId: String(tableId), handNumber: table.handNumber },
      }).catch(() => {});
    }

    const atRisk = atRiskAll(
      shown.pool.map((e) => (e.toObject ? e.toObject() : e)),
      chipsBySeat(shown)
    );

    await PokerHand.create({
      tableId,
      handNumber: table.handNumber,
      button: table.button,
      smallBlind: table.smallBlind,
      bigBlind: table.bigBlind,
      players: table.seats
        .map((s, i) =>
          inHand(s) || s.totalCommitted
            ? {
                userId: s.userId,
                username: s.username,
                seat: i,
                holeCards: s.holeCards,
                startStack: startStacks[i],
                endStack: state.seats[i].stack,
                totalCommitted: s.totalCommitted,
                wonChips: result.won.get(i) || 0,
                folded: s.status === "folded",
                showed: result.showdown && inHand(s),
                handCategory:
                  result.showdown && inHand(s) && board.length
                    ? evaluate([...board, ...s.holeCards]).category
                    : null,
              }
            : null
        )
        .filter(Boolean),
      board,
      lastStreet: reached,
      sawFlop: table.sawFlop,
      pots: result.detail.map((p) => ({ amount: p.amount, eligible: p.eligible, winners: p.winners })),
      rake: result.rake,
      itemsAtRisk: atRisk.map((e) => ({
        uniqueId: e.uniqueId,
        name: e.name,
        rarity: e.rarity,
        value: e.value,
        userId: e.userId,
      })),
      pfServerSeed: table.pfServerSeed,
      pfServerSeedHash: table.pfServerSeedHash,
      combinedClientSeed: combinedClientSeed(table),
      algoVersion: POKER_ALGO_VERSION,
      startedAt: table.lastHandAt,
    });

    // the rest of the site should see a legendary change hands, not just the table
    const takeable = atRisk.filter((e) => Number(e.rarity) >= TICKER_RARITY);
    if (takeable.length) {
      const top = takeable.slice().sort((a, b) => Number(b.rarity) - Number(a.rarity) || b.value - a.value)[0];
      const winnerSeat = [...result.won.entries()].sort((a, b) => b[1] - a[1])[0];
      if (winnerSeat && top) {
        io.emit("poker:onTheLine", {
          tableId: String(tableId),
          tableName: table.name,
          slug: table.slug,
          item: { name: top.name, image: top.image, rarity: top.rarity, value: top.value },
          from: table.seats[top.stakedBy] ? table.seats[top.stakedBy].username : null,
          chasedBy: table.seats[winnerSeat[0]] ? table.seats[winnerSeat[0]].username : null,
        });
      }
    }

    io.to(room(tableId)).emit("poker:showdown", {
      handNumber: table.handNumber,
      board,
      pots: result.detail,
      rake: result.rake,
      // the seed is only safe now: every hole card falls out of it
      pfServerSeed: table.pfServerSeed,
      winners: [...result.won].map(([seat, amount]) => ({
        seat,
        amount,
        username: table.seats[seat].username,
        hand:
          result.showdown && board.length && inHand(table.seats[seat])
            ? CATEGORY_NAME[evaluate([...board, ...table.seats[seat].holeCards]).category]
            : null,
      })),
      atRisk: atRisk.map((e) => ({ name: e.name, rarity: e.rarity, value: e.value, seat: e.stakedBy })),
    });
    await pushTable(io, shown);

    clocks.set(`${tableId}:next`, SETTLE_DELAY_MS, () =>
      finishHand(tableId).catch((e) => console.error("poker finish:", e.message))
    );
  }

  // clear the hand down, honour queued leaves, stand up anybody who busted, then look for
  // the next one
  async function finishHand(tableId) {
    const table = await PokerTable.findById(tableId);
    if (!table || table.status !== "showdown") return;

    const leaving = table.seats.filter((s) => s.userId && (s.leaveAfterHand || s.stack < MIN_TO_PLAY));

    const patch = { status: "idle", street: null, board: [], deck: [], pots: [], toAct: null, actionDeadline: null, currentBet: 0, pfServerSeed: null };
    const satOut = [];
    table.seats.forEach((s, i) => {
      if (!s.userId) return;
      patch[`seats.${i}.holeCards`] = [];
      // three timeouts running is somebody who walked away, and dealing them in forever
      // just makes everyone else wait out the clock every orbit
      const idle = (s.autoFolds || 0) >= AUTOFOLD_LIMIT;
      patch[`seats.${i}.status`] = idle ? "sittingout" : "sitting";
      if (idle) satOut.push({ seat: i, username: s.username, userId: s.userId });
      patch[`seats.${i}.committed`] = 0;
      patch[`seats.${i}.totalCommitted`] = 0;
    });
    const cleared = await commit(tableId, table.actionSeq, { $set: patch });
    if (!cleared) return;

    for (const out of satOut) {
      io.to(room(tableId)).emit("poker:satOut", { seat: out.seat, username: out.username });
      io.to(String(out.userId)).emit("poker:youSatOut", { tableId: String(tableId) });
    }

    for (const s of leaving) {
      // a busted seat still owns whatever it can afford out of the cage, which is usually
      // nothing; cashOut is the only path that touches the pool
      await cashOut(tableId, s.userId).catch(() => releaseSeat(tableId, s.seat));
    }

    const after = await PokerTable.findById(tableId);
    if (after) await pushTable(io, after);
    clocks.set(`${tableId}:start`, START_DELAY_MS, () =>
      startIfReady(tableId).catch((e) => console.error("poker start:", e.message))
    );
  }

  // a table caught mid-hand by a restart. the deck and the seeds are persisted, so the
  // hand is finished from where it stopped rather than voided.
  async function recover() {
    const stuck = await PokerTable.find({ status: { $in: ["betting", "settling", "showdown"] } });
    for (const table of stuck) {
      try {
        if (table.status === "showdown") await finishHand(table._id);
        else if (table.status === "settling") {
          await PokerTable.updateOne({ _id: table._id }, { $set: { status: "betting", lockedAt: null } });
          await settle(table._id);
        } else if (table.toAct === null || table.toAct === undefined) await advance(table._id);
        else await settle(table._id);
      } catch (err) {
        console.error("poker recover:", err.message);
      }
    }
    return stuck.length;
  }

  return {
    redactFor,
    pushTable,
    startIfReady,
    act,
    advance,
    settle,
    finishHand,
    recover,
    clocks,
    room,
    combinedClientSeed,
    playable,
    ACTION_MS,
    AUTOFOLD_LIMIT,
    cardName,
  };
}

// ---------------------------------------------------------------------------
// the lobby. tables are ranked by the rarest item currently on the line, because a
// legendary about to change hands is the thing that pulls a browsing player into a seat.
// ---------------------------------------------------------------------------
const RARITY_ORDER = (r) => Number(r) || 0;

async function lobby() {
  const tables = await PokerTable.find({ active: true }).lean();
  return tables
    .map((table) => {
      const risk = atRiskAll(table.pool || [], chipsBySeat(table));
      const top = risk.slice().sort(
        (a, b) => RARITY_ORDER(b.rarity) - RARITY_ORDER(a.rarity) || b.value - a.value
      )[0];
      return {
        _id: table._id,
        slug: table.slug,
        name: table.name,
        seatCount: table.seatCount,
        smallBlind: table.smallBlind,
        bigBlind: table.bigBlind,
        minBuyIn: table.minBuyIn,
        maxBuyIn: table.maxBuyIn,
        seated: (table.seats || []).filter((s) => s.userId).length,
        status: table.status,
        handNumber: table.handNumber,
        players: (table.seats || [])
          .filter((s) => s.userId)
          .map((s) => ({ seat: s.seat, username: s.username, profilePicture: s.profilePicture, stack: s.stack })),
        poolValue: (table.pool || []).reduce((sum, e) => sum + e.value, 0),
        poolCount: (table.pool || []).length,
        topAtRisk: top ? { name: top.name, image: top.image, rarity: top.rarity, value: top.value } : null,
        atRiskCount: risk.length,
      };
    })
    .sort((a, b) => {
      const ar = a.topAtRisk ? RARITY_ORDER(a.topAtRisk.rarity) : -1;
      const br = b.topAtRisk ? RARITY_ORDER(b.topAtRisk.rarity) : -1;
      return br - ar || b.seated - a.seated || a.bigBlind - b.bigBlind;
    });
}

// ---------------------------------------------------------------------------
// sockets. identity is socket.userId, set by the io middleware from a verified jwt;
// only the table id, the seat and the numeric amounts come off the wire.
// ---------------------------------------------------------------------------
function attach(io) {
  const engine = makeEngine(io);
  const ack = (cb, payload) => typeof cb === "function" && cb(payload);

  io.on("connection", (socket) => {
    socket.on("poker:lobby", async (_ignored, cb) => {
      try {
        ack(cb, { tables: await lobby() });
      } catch (err) {
        ack(cb, { error: "Could not load the lobby" });
      }
    });

    socket.on("poker:watch", async (tableId, cb) => {
      try {
        // the url carries the slug, the lobby carries the id, so either works
        const table = /^[0-9a-fA-F]{24}$/.test(String(tableId))
          ? await PokerTable.findById(tableId)
          : await PokerTable.findOne({ slug: String(tableId) });
        if (!table) return ack(cb, { error: "Table not found" });
        socket.join(room(table._id));
        ack(cb, { table: redactFor(table, socket.userId) });
      } catch (err) {
        ack(cb, { error: "Could not open that table" });
      }
    });

    socket.on("poker:unwatch", (tableId) => socket.leave(room(tableId)));

    socket.on("poker:sit", async ({ tableId, seat, kp, uniqueIds } = {}, cb) => {
      if (!socket.userId) return ack(cb, { error: "Sign in to play" });
      try {
        const res = await buyIn(tableId, socket.userId, { seat, kp, uniqueIds });
        if (res.error) return ack(cb, { error: res.error });
        socket.join(room(tableId));
        await pushTable(io, res.table);
        await pushBalance(io, socket.userId);
        ack(cb, { ok: true, seat: res.seat, stack: res.stack });
        // a seat that completes a table starts the next hand
        await engine.startIfReady(tableId);
      } catch (err) {
        console.error("poker:sit", err.message);
        ack(cb, { error: "Could not sit down" });
      }
    });

    socket.on("poker:stakeable", async (_ignored, cb) => {
      if (!socket.userId) return ack(cb, { error: "Sign in to play" });
      try {
        ack(cb, await stakeableFor(socket.userId));
      } catch (err) {
        ack(cb, { error: "Could not read your inventory" });
      }
    });

    socket.on("poker:sitIn", async (tableId, cb) => {
      if (!socket.userId) return ack(cb, { error: "Sign in to play" });
      try {
        const table = await PokerTable.findById(tableId);
        if (!table) return ack(cb, { error: "Table not found" });
        const index = seatOf(table, socket.userId);
        if (index < 0) return ack(cb, { error: "You are not at this table" });
        if (table.seats[index].status !== "sittingout") return ack(cb, { ok: true });

        const back = await PokerTable.findOneAndUpdate(
          { _id: tableId, [`seats.${index}.userId`]: socket.userId },
          { $set: { [`seats.${index}.status`]: "sitting", [`seats.${index}.autoFolds`]: 0 }, $inc: { actionSeq: 1 } },
          { new: true }
        );
        if (back) await pushTable(io, back);
        ack(cb, { ok: true });
        await engine.startIfReady(tableId);
      } catch (err) {
        ack(cb, { error: "Could not sit back in" });
      }
    });

    socket.on("poker:cashoutOptions", async (tableId, cb) => {
      if (!socket.userId) return ack(cb, { error: "Sign in to play" });
      try {
        const table = await PokerTable.findById(tableId);
        if (!table) return ack(cb, { error: "Table not found" });
        ack(cb, cashOutOptions(table, socket.userId) || { error: "You are not at this table" });
      } catch (err) {
        ack(cb, { error: "Could not read the table" });
      }
    });

    socket.on("poker:leave", async ({ tableId, picks } = {}, cb) => {
      if (!socket.userId) return ack(cb, { error: "Sign in to play" });
      try {
        const res = await cashOut(tableId, socket.userId, picks);
        if (res.error) return ack(cb, { error: res.error });
        if (res.table) await pushTable(io, res.table);
        if (!res.queued) await pushBalance(io, socket.userId);
        ack(cb, { ok: true, queued: !!res.queued, items: res.items || [], kp: res.kp || 0 });
      } catch (err) {
        console.error("poker:leave", err.message);
        ack(cb, { error: "Could not cash out" });
      }
    });

    socket.on("poker:action", async ({ tableId, action, to } = {}, cb) => {
      if (!socket.userId) return ack(cb, { error: "Sign in to play" });
      const verb = String(action || "");
      if (!["fold", "check", "call", "bet", "raise"].includes(verb)) {
        return ack(cb, { error: "Unknown action" });
      }
      const amount = Math.floor(Number(to));
      try {
        const res = await engine.act(tableId, socket.userId, {
          type: verb,
          ...(Number.isFinite(amount) ? { to: amount } : {}),
        });
        ack(cb, res);
      } catch (err) {
        console.error("poker:action", err.message);
        ack(cb, { error: "Could not act" });
      }
    });

    socket.on("poker:history", async (tableId, cb) => {
      try {
        const hands = await PokerHand.find({ tableId })
          .sort({ handNumber: -1 })
          .limit(20)
          .select("handNumber board pots rake players.seat players.username players.wonChips endedAt")
          .lean();
        ack(cb, { hands });
      } catch (err) {
        ack(cb, { error: "Could not load history" });
      }
    });
  });

  return engine;
}

module.exports = attach;
module.exports.attach = attach;
module.exports.makeEngine = makeEngine;
module.exports.redactFor = redactFor;
module.exports.lobby = lobby;
module.exports.room = room;
module.exports.ACTION_MS = ACTION_MS;
module.exports.MIN_TO_PLAY = MIN_TO_PLAY;
module.exports.LEASE_MS = LEASE_MS;
