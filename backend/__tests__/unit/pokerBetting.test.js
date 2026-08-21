const {
  startHand,
  legalActions,
  applyAction,
  advanceStreet,
  roundClosed,
  blindSeats,
  firstToAct,
  normalizeButton,
  handOver,
  SEAT,
} = require("../../utils/pokerBetting");

const table = (stacks, button = 0, smallBlind = 5, bigBlind = 10) =>
  startHand({
    seats: stacks.map((stack) => ({ stack, sittingIn: stack > 0 })),
    button,
    smallBlind,
    bigBlind,
  });

const act = (state, seat, action) => {
  const res = applyAction(state, seat, action);
  if (res.error) throw new Error(`${res.error} (seat ${seat}, ${JSON.stringify(action)})`);
  return res.state;
};

const types = (state, seat) => legalActions(state, seat).map((a) => a.type);

describe("blinds", () => {
  it("posts small then big clockwise from the button at a full table", () => {
    const s = table([100, 100, 100], 0);
    expect(blindSeats(s.seats, 0)).toEqual({ small: 1, big: 2 });
    expect(s.seats[1].committed).toBe(5);
    expect(s.seats[2].committed).toBe(10);
    expect(s.currentBet).toBe(10);
  });

  it("inverts them heads-up: the button is the small blind", () => {
    const s = table([100, 100], 0);
    expect(blindSeats(s.seats, 0)).toEqual({ small: 0, big: 1 });
    expect(s.seats[0].committed).toBe(5);
    expect(s.seats[1].committed).toBe(10);
  });

  it("puts a player too short for a blind all-in for what they have", () => {
    const s = table([100, 3], 0);
    expect(s.seats[1].committed).toBe(3);
    expect(s.seats[1].status).toBe(SEAT.ALLIN);
    // the level to match is still the big blind, the short player is just in for less
    expect(s.currentBet).toBe(10);
  });

  it("moves the button off an empty seat", () => {
    const seats = [{ status: SEAT.OUT }, { status: SEAT.ACTIVE }, { status: SEAT.ACTIVE }];
    expect(normalizeButton(seats, 0)).toBe(1);
    expect(normalizeButton(seats, 2)).toBe(2);
  });
});

describe("acting order", () => {
  it("starts preflop after the big blind and postflop after the button", () => {
    const s = table([100, 100, 100], 0);
    expect(firstToAct(s.seats, 0, "preflop")).toBe(0);
    expect(firstToAct(s.seats, 0, "flop")).toBe(1);
  });

  // the case that actually runs: heads-up the button acts first preflop and last after
  it("heads-up gives the button first action preflop and last on every later street", () => {
    const s = table([100, 100], 0);
    expect(s.toAct).toBe(0);
    expect(firstToAct(s.seats, 0, "flop")).toBe(1);
    expect(firstToAct(s.seats, 0, "river")).toBe(1);
  });

  it("skips seats that are not in the hand", () => {
    const s = table([100, 0, 100, 100], 0);
    expect(s.seats[1].status).toBe(SEAT.OUT);
    expect([0, 2, 3]).toContain(s.toAct);
    expect(s.toAct).not.toBe(1);
  });
});

describe("legal actions", () => {
  it("offers fold, call and raise when facing a bet", () => {
    const s = table([100, 100, 100], 0);
    expect(types(s, 0).sort()).toEqual(["call", "fold", "raise"]);
  });

  it("offers check instead of call when nothing is owed", () => {
    let s = table([100, 100], 0);
    s = act(s, 0, { type: "call" });
    expect(types(s, 1).sort()).toEqual(["check", "fold", "raise"]);
  });

  it("gives nobody actions out of turn", () => {
    const s = table([100, 100, 100], 0);
    expect(legalActions(s, 1)).toEqual([]);
    expect(legalActions(s, 2)).toEqual([]);
  });

  it("sets the minimum raise to one big blind over the current bet", () => {
    const s = table([100, 100, 100], 0);
    const raise = legalActions(s, 0).find((a) => a.type === "raise");
    expect(raise.min).toBe(20);
    expect(raise.max).toBe(100);
  });

  it("caps the raise at the stack and flags an all-in that cannot reach the minimum", () => {
    const s = table([100, 100, 60], 0);
    let next = act(s, 0, { type: "raise", to: 40 });
    const raise = legalActions(next, 1).find((a) => a.type === "raise");
    expect(raise.min).toBe(70);
    next = act(next, 1, { type: "fold" });
    const short = legalActions(next, 2).find((a) => a.type === "raise");
    expect(short.allInOnly).toBe(true);
    expect(short.max).toBe(60);
  });

  it("offers no raise at all to a seat too short to get past the call", () => {
    let next = act(table([100, 100, 15], 0), 0, { type: "raise", to: 40 });
    next = act(next, 1, { type: "fold" });
    expect(types(next, 2).sort()).toEqual(["call", "fold"]);
  });
});

describe("raising", () => {
  it("rejects a raise below the minimum", () => {
    const s = table([100, 100, 100], 0);
    expect(applyAction(s, 0, { type: "raise", to: 15 }).error).toBeTruthy();
  });

  it("rejects a raise above the stack", () => {
    const s = table([100, 100, 100], 0);
    expect(applyAction(s, 0, { type: "raise", to: 101 }).error).toBeTruthy();
  });

  it("raises the minimum for the next raise to the size of the last one", () => {
    let s = table([500, 500, 500], 0);
    s = act(s, 0, { type: "raise", to: 40 }); // raised by 30
    expect(s.minRaise).toBe(30);
    const raise = legalActions(s, 1).find((a) => a.type === "raise");
    expect(raise.min).toBe(70);
  });

  it("reopens the betting for everyone after a full raise", () => {
    let s = table([500, 500, 500], 0);
    s = act(s, 0, { type: "call" });
    s = act(s, 1, { type: "call" });
    s = act(s, 2, { type: "raise", to: 50 });
    expect(s.seats[0].hasActed).toBe(false);
    expect(s.seats[0].canRaise).toBe(true);
    expect(roundClosed(s)).toBe(false);
  });
});

describe("the short all-in rule", () => {
  it("does not reopen the betting for a player who already acted", () => {
    let s = table([500, 500, 55], 0, 5, 10);
    s = act(s, 0, { type: "raise", to: 50 }); // full raise, minRaise now 40
    s = act(s, 1, { type: "call" });
    // seat 2 shoves 55: only 5 more than the 50 bet, far short of a 40 minimum raise
    s = act(s, 2, { type: "raise", to: 55 });
    expect(s.seats[2].status).toBe(SEAT.ALLIN);
    // both owe another 5, but neither may raise again
    expect(s.seats[0].hasActed).toBe(false);
    expect(s.seats[0].canRaise).toBe(false);
    expect(types(s, 0).sort()).toEqual(["call", "fold"]);
  });

  it("leaves the minimum raise alone, so a later full raise still measures from the old one", () => {
    let s = table([500, 500, 55], 0, 5, 10);
    s = act(s, 0, { type: "raise", to: 50 });
    s = act(s, 1, { type: "call" });
    s = act(s, 2, { type: "raise", to: 55 });
    expect(s.minRaise).toBe(40);
  });

  it("still reopens for a player who had not acted yet", () => {
    // button 0, so the blinds are seats 1 and 2 and the action opens on seat 3
    let s = table([55, 500, 500, 500], 0, 5, 10);
    s = act(s, 3, { type: "raise", to: 50 });
    s = act(s, 0, { type: "raise", to: 55 }); // all-in, five short of a full raise
    expect(s.seats[0].status).toBe(SEAT.ALLIN);
    expect(s.seats[3].canRaise).toBe(false);
    expect(s.seats[1].canRaise).toBe(true);
    expect(types(s, 1)).toContain("raise");
  });
});

describe("closing a round", () => {
  it("stays open until the big blind takes their option", () => {
    let s = table([100, 100], 0);
    s = act(s, 0, { type: "call" });
    expect(roundClosed(s)).toBe(false);
    expect(s.toAct).toBe(1);
    s = act(s, 1, { type: "check" });
    expect(roundClosed(s)).toBe(true);
    expect(s.toAct).toBeNull();
  });

  it("closes once every live player has matched and acted", () => {
    let s = table([100, 100, 100], 0);
    s = act(s, 0, { type: "call" });
    s = act(s, 1, { type: "call" });
    s = act(s, 2, { type: "check" });
    expect(roundClosed(s)).toBe(true);
  });

  it("closes when everyone folds to one player", () => {
    let s = table([100, 100, 100], 0);
    s = act(s, 0, { type: "fold" });
    s = act(s, 1, { type: "fold" });
    expect(handOver(s)).toBe(true);
  });
});

describe("streets", () => {
  it("resets the bet and hands action to the first live seat after the button", () => {
    let s = table([100, 100, 100], 0);
    s = act(s, 0, { type: "call" });
    s = act(s, 1, { type: "call" });
    s = act(s, 2, { type: "check" });
    const { done } = advanceStreet(s, 0);
    expect(done).toBe(false);
    expect(s.street).toBe("flop");
    expect(s.currentBet).toBe(0);
    expect(s.minRaise).toBe(10);
    expect(s.toAct).toBe(1);
    expect(s.seats.every((x) => x.committed === 0)).toBe(true);
  });

  it("keeps the hand total across streets", () => {
    let s = table([100, 100], 0);
    s = act(s, 0, { type: "call" });
    s = act(s, 1, { type: "check" });
    advanceStreet(s, 0);
    s = act(s, 1, { type: "bet", to: 20 });
    s = act(s, 0, { type: "call" });
    expect(s.seats[0].totalCommitted).toBe(30);
    expect(s.seats[1].totalCommitted).toBe(30);
  });

  it("has nobody to act once everyone is all-in", () => {
    let s = table([100, 100], 0);
    s = act(s, 0, { type: "raise", to: 100 });
    s = act(s, 1, { type: "call" });
    advanceStreet(s, 0);
    expect(s.toAct).toBeNull();
  });

  it("stops after the river", () => {
    const s = table([100, 100], 0);
    s.street = "river";
    expect(advanceStreet(s, 0).done).toBe(true);
  });
});

describe("stacks", () => {
  it("never lets a seat commit more than it holds", () => {
    let s = table([100, 40], 0);
    s = act(s, 0, { type: "raise", to: 100 });
    s = act(s, 1, { type: "call" });
    expect(s.seats[1].stack).toBe(0);
    expect(s.seats[1].totalCommitted).toBe(40);
    expect(s.seats[1].status).toBe(SEAT.ALLIN);
  });

  it("marks a seat all-in when a call empties it", () => {
    let s = table([100, 100, 30], 0);
    s = act(s, 0, { type: "raise", to: 60 });
    s = act(s, 1, { type: "fold" });
    s = act(s, 2, { type: "call" });
    expect(s.seats[2].stack).toBe(0);
    expect(s.seats[2].status).toBe(SEAT.ALLIN);
  });
});
