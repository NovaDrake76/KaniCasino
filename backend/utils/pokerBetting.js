// the betting round as a pure reducer. no io, no database, no clock: the engine calls
// legalActions/applyAction and persists whatever comes back, so every rule below is
// testable on its own and a bug here cannot be hidden by socket timing.

const STREETS = ["preflop", "flop", "turn", "river"];

// seat status. `out` is a seat that is not in the hand at all (empty, sitting out, or
// busted), as distinct from `folded`, which was dealt in and gave up.
const SEAT = { OUT: "out", ACTIVE: "active", FOLDED: "folded", ALLIN: "allin" };

const isIn = (s) => s.status === SEAT.ACTIVE || s.status === SEAT.ALLIN;
const canAct = (s) => s.status === SEAT.ACTIVE;

// seats in acting order starting after `from`, wrapping once
function orderFrom(seats, from) {
  const out = [];
  for (let step = 1; step <= seats.length; step++) {
    out.push((from + step) % seats.length);
  }
  return out;
}

const nextToAct = (seats, from) => orderFrom(seats, from).find((i) => canAct(seats[i]));

// the button must sit on a seat that is actually in the hand, or the blinds come off an
// empty chair. callers move it blind, so it is normalised here rather than at every use.
function normalizeButton(seats, button) {
  if (seats[button] && isIn(seats[button])) return button;
  const next = orderFrom(seats, button).find((i) => isIn(seats[i]));
  return next === undefined ? button : next;
}

// heads-up inverts the blinds: the button posts the small blind and acts first preflop,
// then acts last on every later street. this is the case that will run most often, so it
// is a correctness requirement rather than an edge case.
function blindSeats(seats, rawButton) {
  const button = normalizeButton(seats, rawButton);
  const dealt = seats.map((s, i) => (isIn(s) ? i : -1)).filter((i) => i >= 0);
  if (dealt.length === 2) {
    const other = dealt.find((i) => i !== button);
    return { small: button, big: other };
  }
  const after = orderFrom(seats, button).filter((i) => isIn(seats[i]));
  return { small: after[0], big: after[1] };
}

// who acts first on a street. preflop it is the seat after the big blind; afterwards it
// is the first seat after the button, which heads-up is the big blind.
function firstToAct(seats, rawButton, street) {
  const button = normalizeButton(seats, rawButton);
  const { big } = blindSeats(seats, button);
  const from = street === "preflop" ? big : button;
  return nextToAct(seats, from);
}

// chips a seat still owes to match the current bet, capped at what they actually have
const owed = (state, seat) => {
  const s = state.seats[seat];
  return Math.min(state.currentBet - s.committed, s.stack);
};

function legalActions(state, seat) {
  const s = state.seats[seat];
  if (!canAct(s) || state.toAct !== seat) return [];

  const toCall = state.currentBet - s.committed;
  const actions = [{ type: "fold" }];

  if (toCall <= 0) actions.push({ type: "check" });
  else actions.push({ type: "call", amount: Math.min(toCall, s.stack) });

  // a raise needs chips beyond the call, and the betting has to be open to this seat: a
  // short all-in does not reopen it for anyone who already acted
  const maxTo = s.committed + s.stack;
  if (s.stack > toCall && s.canRaise) {
    const minTo = state.currentBet + state.minRaise;
    // short of a full raise, all-in is still allowed; it just does not reopen betting
    actions.push({
      type: state.currentBet > 0 ? "raise" : "bet",
      min: Math.min(minTo, maxTo),
      max: maxTo,
      allInOnly: maxTo < minTo,
    });
  }
  return actions;
}

// true when nobody is left to act on this street
function roundClosed(state) {
  const live = state.seats.filter(canAct);
  if (live.length === 0) return true;
  // one player still able to act, with everyone else all-in or folded, closes the street
  // as soon as they have matched
  return live.every((s) => s.hasActed && s.committed === state.currentBet);
}

const activeCount = (state) => state.seats.filter(isIn).length;
const contestedCount = (state) => state.seats.filter(canAct).length;

// everyone but one player folded: the hand is over without a showdown
const handOver = (state) => activeCount(state) <= 1;

// reset per-street flags. an aggressive action makes every other live seat owe another
// decision; a short all-in makes them owe chips but takes away the right to raise.
function reopen(state, actor, full) {
  for (let i = 0; i < state.seats.length; i++) {
    const s = state.seats[i];
    if (i === actor || !canAct(s)) continue;
    s.hasActed = false;
    if (full) s.canRaise = true;
  }
}

function applyAction(state, seat, action) {
  const s = state.seats[seat];
  const legal = legalActions(state, seat);
  const match = legal.find((a) => a.type === action.type);
  if (!match) return { error: "Illegal action" };

  if (action.type === "fold") {
    s.status = SEAT.FOLDED;
    s.hasActed = true;
  } else if (action.type === "check") {
    s.hasActed = true;
    s.canRaise = false;
  } else if (action.type === "call") {
    const pay = owed(state, seat);
    s.stack -= pay;
    s.committed += pay;
    s.totalCommitted += pay;
    s.hasActed = true;
    s.canRaise = false;
    if (s.stack === 0) s.status = SEAT.ALLIN;
  } else {
    const to = Math.floor(Number(action.to));
    if (!Number.isFinite(to) || to < match.min || to > match.max) {
      return { error: "Raise out of range" };
    }
    const pay = to - s.committed;
    const raiseBy = to - state.currentBet;
    // a raise that clears the minimum reopens the betting for everyone; one that does not
    // can only be a short all-in, and it does not
    const full = raiseBy >= state.minRaise;

    s.stack -= pay;
    s.committed = to;
    s.totalCommitted += pay;
    s.hasActed = true;
    s.canRaise = false;
    if (s.stack === 0) s.status = SEAT.ALLIN;

    state.currentBet = to;
    if (full) state.minRaise = raiseBy;
    state.lastAggressor = seat;
    reopen(state, seat, full);
  }

  // the last player standing is never asked to act: once everyone else has folded the
  // hand is already theirs, and letting them fold would fold the whole table out
  state.toAct = handOver(state) || roundClosed(state) ? null : nextToAct(state.seats, seat);
  return { ok: true, state };
}

// move to the next street: street bets fold into the hand total, flags reset, and action
// starts left of the button again
function advanceStreet(state, button) {
  const index = STREETS.indexOf(state.street);
  if (index < 0 || index === STREETS.length - 1) return { done: true, state };

  state.street = STREETS[index + 1];
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.lastAggressor = null;
  for (const s of state.seats) {
    s.committed = 0;
    s.hasActed = false;
    s.canRaise = canAct(s);
  }
  // with everyone all-in there is nobody to act; the engine runs the board out
  state.toAct = contestedCount(state) > 1 ? firstToAct(state.seats, button, state.street) : null;
  return { done: false, state };
}

// build the opening state of a hand and post the blinds. blinds are forced, so they are
// posted directly rather than through applyAction, and a player too short to cover one
// posts what they have and is all-in.
function startHand({ seats, button, smallBlind, bigBlind }) {
  const state = {
    street: "preflop",
    seats: seats.map((s) => ({
      stack: s.stack,
      committed: 0,
      totalCommitted: 0,
      status: s.sittingIn && s.stack > 0 ? SEAT.ACTIVE : SEAT.OUT,
      hasActed: false,
      canRaise: true,
    })),
    currentBet: 0,
    minRaise: bigBlind,
    bigBlind,
    lastAggressor: null,
    toAct: null,
  };

  const { small, big } = blindSeats(state.seats, button);
  const post = (seat, amount) => {
    if (seat === undefined || seat === null) return;
    const s = state.seats[seat];
    const pay = Math.min(amount, s.stack);
    s.stack -= pay;
    s.committed = pay;
    s.totalCommitted = pay;
    if (s.stack === 0) s.status = SEAT.ALLIN;
    state.currentBet = Math.max(state.currentBet, pay);
  };
  post(small, smallBlind);
  post(big, bigBlind);
  // the big blind is live: they have money in without having chosen anything, so they get
  // the option to raise when the action comes back
  state.currentBet = Math.max(state.currentBet, bigBlind);
  state.toAct = firstToAct(state.seats, button, "preflop");
  return state;
}

module.exports = {
  STREETS,
  SEAT,
  isIn,
  canAct,
  orderFrom,
  nextToAct,
  normalizeButton,
  blindSeats,
  firstToAct,
  owed,
  legalActions,
  applyAction,
  roundClosed,
  advanceStreet,
  startHand,
  handOver,
  activeCount,
  contestedCount,
};
