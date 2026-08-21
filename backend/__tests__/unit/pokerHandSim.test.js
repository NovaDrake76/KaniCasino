const {
  startHand,
  legalActions,
  applyAction,
  advanceStreet,
  handOver,
  SEAT,
} = require("../../utils/pokerBetting");
const { settleHand, chipsBalance } = require("../../utils/pokerSettle");
const { shuffle, deal, boardFor } = require("../../utils/pokerCards");

// a tiny deterministic generator, so a failure is reproducible from its seed alone rather
// than being a coin flip nobody can chase down
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];

// play one whole hand of random but always legal poker and settle it
function playHand(seed) {
  const random = rng(seed);
  const seatCount = 2 + Math.floor(random() * 5);
  const stacks = Array.from({ length: seatCount }, () => 10 + Math.floor(random() * 900));
  const bigBlind = 10;
  const button = Math.floor(random() * seatCount);

  const state = startHand({
    seats: stacks.map((stack) => ({ stack, sittingIn: true })),
    button,
    smallBlind: bigBlind / 2,
    bigBlind,
  });

  const deck = shuffle(`s${seed}`, `c${seed}`, seed);
  const dealt = deal(deck, seatCount);
  const holeCards = {};
  state.seats.forEach((s, i) => {
    holeCards[i] = dealt.holes[i];
  });

  let guard = 0;
  let sawFlop = false;
  for (;;) {
    while (state.toAct !== null && state.toAct !== undefined) {
      if (guard++ > 5000) throw new Error(`hand ${seed} never closed`);
      const seat = state.toAct;
      const options = legalActions(state, seat);
      if (!options.length) throw new Error(`hand ${seed}: seat ${seat} to act with no options`);
      const choice = pick(random, options);
      const action =
        choice.type === "raise" || choice.type === "bet"
          ? { type: choice.type, to: choice.min + Math.floor(random() * (choice.max - choice.min + 1)) }
          : { type: choice.type };
      const res = applyAction(state, seat, action);
      if (res.error) throw new Error(`hand ${seed}: ${res.error}`);
    }
    if (handOver(state)) break;
    const { done } = advanceStreet(state, button);
    if (done) break;
    if (state.street === "flop") sawFlop = true;
  }

  const board = boardFor(dealt, handOver(state) ? state.street : "showdown");
  const result = settleHand({ state, button, bigBlind, sawFlop, holeCards, board });
  return { seed, stacks, state, result, seatCount };
}

describe("a whole hand, ten thousand times", () => {
  it("never mints or burns a chip", () => {
    for (let seed = 1; seed <= 10000; seed++) {
      const { stacks, state, result } = playHand(seed);
      const balance = chipsBalance(stacks, state, result.rake);
      if (!balance.ok) {
        throw new Error(
          `hand ${seed}: ${balance.before} chips in, ${balance.after} out (rake ${result.rake})`
        );
      }
    }
  });

  it("never leaves a seat with a negative stack", () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const { state, seed: s } = playHand(seed);
      for (const [i, x] of state.seats.entries()) {
        if (x.stack < 0) throw new Error(`hand ${s}: seat ${i} went to ${x.stack}`);
      }
    }
  });

  it("always leaves at least one player in the hand", () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const { state, seed: s } = playHand(seed);
      const live = state.seats.filter((x) => x.status === SEAT.ACTIVE || x.status === SEAT.ALLIN);
      if (live.length < 1) throw new Error(`hand ${s}: everybody folded`);
    }
  });

  it("never rakes a hand that ended before the flop", () => {
    let checked = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const { state, result } = playHand(seed);
      if (state.street === "preflop") {
        expect(result.rake).toBe(0);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("pays out every chip in the pots", () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const { result, seed: s } = playHand(seed);
      const potted = result.pots.reduce((sum, p) => sum + p.amount, 0);
      const paid = [...result.won.values()].reduce((sum, v) => sum + v, 0);
      if (potted !== paid) throw new Error(`hand ${s}: ${potted} in pots, ${paid} paid`);
    }
  });

  it("only ever pays a seat that was eligible for that pot", () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const { result, seed: s } = playHand(seed);
      for (const pot of result.detail) {
        for (const winner of pot.winners) {
          if (!pot.eligible.includes(winner)) {
            throw new Error(`hand ${s}: seat ${winner} paid from a pot it was not in`);
          }
        }
      }
    }
  });
});

describe("the simulation itself", () => {
  it("is deterministic, so a failing seed can be replayed", () => {
    const a = playHand(4242);
    const b = playHand(4242);
    expect(a.state.seats.map((s) => s.stack)).toEqual(b.state.seats.map((s) => s.stack));
    expect(a.result.rake).toBe(b.result.rake);
  });

  it("actually reaches every street across a run", () => {
    const streets = new Set();
    for (let seed = 1; seed <= 500; seed++) streets.add(playHand(seed).state.street);
    expect(streets).toContain("preflop");
    expect(streets).toContain("flop");
    expect(streets).toContain("river");
  });
});
