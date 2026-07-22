const crypto = require("crypto");
const { FLOAT_BYTES } = require("../../utils/provablyFair");
const {
  MIN_BET,
  MAX_BET,
  drawCard,
  rankOf,
  suitOf,
  cardValue,
  handTotal,
  isBlackjack,
  naturalPayout,
  insurancePayout,
  dealerPlay,
  settle,
  dealState,
  applyInsurance,
  applyMove,
  legalMoves,
  replayHand,
} = require("../../utils/blackjackMath");

// card indexes by the fixed mapping: rank = idx % 13 (0 = ace), suit = floor(idx / 13)
const A = 0, TWO = 1, SIX = 5, SEVEN = 6, EIGHT = 7, NINE = 8, TEN = 9, JACK = 10, KING = 12;
const A2 = 13; // ace of hearts
const EIGHT2 = 20; // eight of hearts

// scripted draw for dealerPlay: feed exact cards in call order
const scripted = (queue) => () => {
  if (!queue.length) throw new Error("scripted deck exhausted");
  return queue.shift();
};

// scripted draw for the state machine: cards indexed by CURSOR, matching the
// fixed layout (0 player, 1 dealer up, 2 player, 3 hole, 4+ in play order)
const deckByCursor = (cards) => (cursor) => {
  if (cards[cursor] === undefined) throw new Error(`no card scripted for cursor ${cursor}`);
  return cards[cursor];
};

describe("card mapping", () => {
  test("rank and suit decode the fixed 0..51 scheme", () => {
    expect(rankOf(0)).toBe(0);
    expect(suitOf(0)).toBe(0);
    expect(rankOf(13)).toBe(0);
    expect(suitOf(13)).toBe(1);
    expect(rankOf(51)).toBe(12);
    expect(suitOf(51)).toBe(3);
  });

  test("card values: ace 11, faces 10, pips face value", () => {
    expect(cardValue(A)).toBe(11);
    expect(cardValue(TWO)).toBe(2);
    expect(cardValue(NINE)).toBe(9);
    expect(cardValue(TEN)).toBe(10);
    expect(cardValue(JACK)).toBe(10);
    expect(cardValue(KING)).toBe(10);
  });
});

describe("drawCard", () => {
  const serverSeed = "b".repeat(64);
  const clientSeed = "kani";

  test("matches an independent third-party reproduction", () => {
    const digest = crypto.createHmac("sha256", serverSeed).update(`${clientSeed}:5:3`).digest();
    let float = 0;
    for (let i = 0; i < FLOAT_BYTES; i++) float += digest[i] / 256 ** (i + 1);
    expect(drawCard(serverSeed, clientSeed, 5, 3)).toBe(Math.floor(float * 52));
  });

  test("every draw is a valid card and deterministic", () => {
    for (let cursor = 0; cursor < 500; cursor++) {
      const card = drawCard(serverSeed, clientSeed, 1, cursor);
      expect(card).toBeGreaterThanOrEqual(0);
      expect(card).toBeLessThanOrEqual(51);
      expect(drawCard(serverSeed, clientSeed, 1, cursor)).toBe(card);
    }
  });
});

describe("handTotal soft-ace accounting", () => {
  test.each([
    [[A], 11, true],
    [[A, A2], 12, true],
    [[A, TEN], 21, true],
    [[A, SIX], 17, true],
    [[A, SIX, TEN], 17, false],
    [[A, A2, NINE], 21, true],
    [[TEN, NINE, A], 20, false],
    [[TEN, NINE, SEVEN], 26, false],
  ])("%j totals %i (soft %s)", (cards, total, soft) => {
    expect(handTotal(cards)).toEqual({ total, soft });
  });
});

describe("naturals and side-bet payouts", () => {
  test("only a two-card unsplit 21 is a natural", () => {
    expect(isBlackjack([A, TEN])).toBe(true);
    expect(isBlackjack([A, KING])).toBe(true);
    expect(isBlackjack([SEVEN, SEVEN, SEVEN])).toBe(false);
    expect(isBlackjack([TEN, NINE])).toBe(false);
  });

  test("3:2 payout floors on odd bets", () => {
    expect(naturalPayout(1)).toBe(2);
    expect(naturalPayout(3)).toBe(7);
    expect(naturalPayout(5)).toBe(12);
    expect(naturalPayout(100)).toBe(250);
  });

  test("insurance pays 2:1", () => {
    expect(insurancePayout(50)).toBe(150);
    expect(insurancePayout(0)).toBe(0);
  });
});

describe("dealerPlay S17", () => {
  test("stands on soft 17 without drawing", () => {
    expect(dealerPlay([A, SIX], scripted([TEN]))).toEqual([A, SIX]);
  });

  test("draws to a soft 17 and stands", () => {
    expect(dealerPlay([A, TWO], scripted([3, TEN]))).toEqual([A, TWO, 3]);
  });

  test("draws on hard 16, stands on hard 17", () => {
    expect(dealerPlay([TEN, SIX], scripted([TWO]))).toEqual([TEN, SIX, TWO]);
    expect(dealerPlay([TEN, SEVEN], scripted([TWO]))).toEqual([TEN, SEVEN]);
  });
});

describe("settlement matrix", () => {
  const hand = (cards, bet = 100, doubled = false, fromSplit = false) => ({ cards, bet, doubled, fromSplit });

  test.each([
    ["player higher wins 1:1", hand([TEN, NINE]), [TEN, SEVEN, A], "win", 200],
    ["dealer higher loses", hand([TEN, SEVEN]), [TEN, NINE], "lose", 0],
    ["equal totals push the stake", hand([TEN, NINE]), [NINE, TEN], "push", 100],
    ["player bust always loses", hand([TEN, NINE, SEVEN]), [TEN, TEN, TEN], "lose", 0],
    ["dealer bust pays the survivor", hand([TEN, SEVEN]), [TEN, SIX, NINE], "win", 200],
    ["both naturals push", hand([A, TEN]), [A2, KING], "push", 100],
    ["dealer natural beats twenty", hand([TEN, TEN]), [A, KING], "lose", 0],
    ["player natural beats a 3-card 21", hand([A, TEN]), [SEVEN, SEVEN, SEVEN], "blackjack", 250],
    ["a doubled win pays double", hand([TEN, NINE], 200, true), [TEN, SEVEN], "win", 400],
    ["a split 21 is not a natural", hand([A, TEN], 100, false, true), [TEN, SEVEN], "win", 200],
  ])("%s", (_label, playerHand, dealerCards, outcome, payout) => {
    const result = settle([playerHand], dealerCards);
    expect(result.perHand[0]).toEqual({ outcome, payout });
    expect(result.totalPayout).toBe(payout);
  });
});

describe("state machine: split", () => {
  test("splitting eights makes two hands playing left to right, drawing chronologically", () => {
    const draw = deckByCursor([EIGHT, NINE, EIGHT2, SIX, TEN, SEVEN, NINE, TWO]);
    let state = dealState(100, draw);
    expect(legalMoves(state).canSplit).toBe(true);

    state = applyMove(state, "split", draw);
    expect(state.hands).toHaveLength(2);
    expect(state.hands[0].cards).toEqual([EIGHT, TEN]);
    expect(state.hands[1].cards).toEqual([EIGHT2]); // waits for its card
    expect(state.activeHandIndex).toBe(0);
    expect(state.hands[0].fromSplit).toBe(true);

    state = applyMove(state, "hit", draw); // 8+10+7 busts; hand 2 activates and draws NINE
    expect(state.hands[0].done).toBe(true);
    expect(state.hands[1].cards).toEqual([EIGHT2, NINE]);
    expect(state.activeHandIndex).toBe(1);
    expect(state.finished).toBe(false);

    state = applyMove(state, "stand", draw); // dealer 9+6 draws TWO -> 17; hand 2 pushes on 17
    expect(state.finished).toBe(true);
    expect(state.result.perHand[0]).toEqual({ outcome: "lose", payout: 0 });
    expect(state.result.perHand[1]).toEqual({ outcome: "push", payout: 100 });
  });

  test("equal value but unequal rank cannot split", () => {
    const draw = deckByCursor([KING, NINE, JACK, SIX]);
    const state = dealState(100, draw);
    expect(legalMoves(state).canSplit).toBe(false);
    expect(() => applyMove(state, "split", draw)).toThrow();
  });

  test("split aces take exactly one card each and settle at 1:1", () => {
    const draw = deckByCursor([A, NINE, A2, SIX, TEN, NINE, TWO]);
    let state = dealState(100, draw);
    state = applyMove(state, "split", draw);
    expect(state.finished).toBe(true);
    expect(state.hands[0].cards).toEqual([A, TEN]);
    expect(state.hands[1].cards).toEqual([A2, NINE]);
    expect(state.result.perHand[0]).toEqual({ outcome: "win", payout: 200 });
    expect(state.result.perHand[1]).toEqual({ outcome: "win", payout: 200 });
  });

  test("double after split raises that hand's stake only", () => {
    const draw = deckByCursor([EIGHT, 4, EIGHT2, NINE, TWO, NINE, SIX, TWO, SIX]);
    let state = dealState(100, draw);
    state = applyMove(state, "split", draw);
    expect(legalMoves(state).canDouble).toBe(true);
    state = applyMove(state, "double", draw);
    expect(state.hands[0].doubled).toBe(true);
    expect(state.hands[0].bet).toBe(200);
    expect(state.hands[1].bet).toBe(100);
    expect(state.activeHandIndex).toBe(1);
    state = applyMove(state, "stand", draw);
    expect(state.finished).toBe(true);
  });
});

describe("state machine: insurance", () => {
  test("an ace upcard pauses for insurance before any peek", () => {
    const draw = deckByCursor([TEN, A, NINE, KING]);
    const state = dealState(100, draw);
    expect(state.awaitingInsurance).toBe(true);
    expect(state.finished).toBe(false);
    const legal = legalMoves(state);
    expect(legal.canInsure).toBe(true);
    expect(legal.canHit).toBe(false);
    expect(() => applyMove(state, "hit", draw)).toThrow();
  });

  test("accepted insurance pays 2:1 when the dealer has the natural", () => {
    const draw = deckByCursor([TEN, A, NINE, KING]);
    let state = dealState(100, draw);
    state = applyInsurance(state, true, draw);
    expect(state.finished).toBe(true);
    expect(state.insuranceBet).toBe(50);
    expect(state.result.perHand[0].outcome).toBe("lose");
    expect(state.result.totalPayout).toBe(150);
    expect(state.result.won).toBe(true);
  });

  test("declined insurance against a dealer natural just loses the hand", () => {
    const draw = deckByCursor([TEN, A, NINE, KING]);
    let state = dealState(100, draw);
    state = applyInsurance(state, false, draw);
    expect(state.finished).toBe(true);
    expect(state.insuranceBet).toBe(0);
    expect(state.result.totalPayout).toBe(0);
  });

  test("no dealer natural: the side bet is lost and play continues", () => {
    const draw = deckByCursor([TEN, A, NINE, SIX, TWO]);
    let state = dealState(100, draw);
    state = applyInsurance(state, true, draw);
    expect(state.finished).toBe(false);
    expect(state.insuranceBet).toBe(50);
    state = applyMove(state, "stand", draw); // dealer stands soft 17; 19 wins
    expect(state.result.perHand[0].outcome).toBe("win");
    expect(state.result.totalPayout).toBe(200);
  });

  test("a player natural vs dealer ace resolves after the decision", () => {
    const draw = deckByCursor([A, A2, TEN, SIX]);
    let state = dealState(100, draw);
    expect(state.awaitingInsurance).toBe(true);
    state = applyInsurance(state, false, draw);
    expect(state.finished).toBe(true);
    expect(state.result.perHand[0].outcome).toBe("blackjack");
    expect(state.result.totalPayout).toBe(naturalPayout(100));
  });
});

describe("replayHand", () => {
  const serverSeed = "c".repeat(64);
  const clientSeed = "replay";
  const drawAt = (nonce, cursor) => drawCard(serverSeed, clientSeed, nonce, cursor);
  const opener = (nonce) => ({
    p: [drawAt(nonce, 0), drawAt(nonce, 2)],
    up: drawAt(nonce, 1),
    hole: drawAt(nonce, 3),
  });

  test("is deterministic and internally consistent for a scripted action list", () => {
    let nonce = 0;
    for (; ; nonce++) {
      const { p, up, hole } = opener(nonce);
      if (rankOf(up) !== 0 && !isBlackjack(p) && !isBlackjack([up, hole]) && handTotal(p).total < 21) break;
    }
    const input = { serverSeed, clientSeed, nonce, betAmount: 100, actions: ["deal", "stand"] };
    const a = replayHand(input);
    const b = replayHand(input);
    expect(a).toEqual(b);
    expect(a.finished).toBe(true);
    expect(a.hands[0].cards[0]).toBe(drawAt(nonce, 0));
    expect(a.dealerCards[0]).toBe(drawAt(nonce, 1));
    expect(a.dealerCards[1]).toBe(drawAt(nonce, 3));
    expect(a.totalPayout).toBe(a.perHand[0].payout);
  });

  test("a dealt natural (no ace up) settles with no further draws regardless of actions", () => {
    let nonce = 0;
    for (; ; nonce++) {
      const { p, up } = opener(nonce);
      if (isBlackjack(p) && rankOf(up) !== 0) break;
    }
    const out = replayHand({ serverSeed, clientSeed, nonce, betAmount: 100, actions: ["deal", "hit", "hit"] });
    expect(out.hands[0].cards).toHaveLength(2);
    expect(out.nextCursor).toBe(4);
    expect(["blackjack", "push"]).toContain(out.perHand[0].outcome);
  });

  test("an ace-up hand replays through the recorded insurance decision", () => {
    let nonce = 0;
    for (; ; nonce++) {
      const { p, up, hole } = opener(nonce);
      if (rankOf(up) === 0 && !isBlackjack([up, hole]) && !isBlackjack(p) && handTotal(p).total < 21) break;
    }
    const out = replayHand({ serverSeed, clientSeed, nonce, betAmount: 100, actions: ["deal", "insure", "stand"] });
    expect(out.finished).toBe(true);
    expect(out.insuranceBet).toBe(50);
  });

  test("a split hand replays card-for-card", () => {
    let nonce = 0;
    for (; ; nonce++) {
      const { p, up, hole } = opener(nonce);
      if (
        rankOf(up) !== 0 &&
        !isBlackjack([up, hole]) &&
        rankOf(p[0]) === rankOf(p[1]) &&
        rankOf(p[0]) !== 0 &&
        handTotal(p).total < 21
      ) {
        break;
      }
    }
    const out = replayHand({
      serverSeed, clientSeed, nonce, betAmount: 100,
      actions: ["deal", "split", "stand", "stand"],
    });
    expect(out.finished).toBe(true);
    expect(out.hands).toHaveLength(2);
    expect(out.hands[0].cards[1]).toBe(drawAt(nonce, 4)); // chronological split draws
    expect(out.perHand).toHaveLength(2);
  });
});

// the pre-launch gate: play a large sample of basic-strategy rounds through the
// real machine and check the realized return sits at the designed ~99.4% RTP.
describe("house edge simulation", () => {
  // S17 infinite-deck basic strategy (insurance always declined)
  function chooseMove(state) {
    const legal = legalMoves(state);
    const hand = state.hands[state.activeHandIndex];
    const up = cardValue(state.dealerCards[0]);
    const { total, soft } = handTotal(hand.cards);

    if (legal.canSplit) {
      const pairRank = rankOf(hand.cards[0]);
      const splitIt =
        pairRank === 0 || pairRank === 7 ||
        ((pairRank === 1 || pairRank === 2 || pairRank === 6) && up >= 2 && up <= 7) ||
        (pairRank === 5 && up >= 2 && up <= 6) ||
        (pairRank === 8 && ((up >= 2 && up <= 6) || up === 8 || up === 9));
      if (splitIt) return "split";
    }
    if (soft) {
      if (total >= 19) return "stand";
      if (total === 18) {
        if (legal.canDouble && up >= 3 && up <= 6) return "double";
        if (up >= 9) return "hit";
        return "stand";
      }
      if (legal.canDouble) {
        if (
          (total === 17 && up >= 3 && up <= 6) ||
          (total >= 15 && total <= 16 && up >= 4 && up <= 6) ||
          (total >= 13 && total <= 14 && up >= 5 && up <= 6)
        ) {
          return "double";
        }
      }
      return "hit";
    }
    if (total >= 17) return "stand";
    if (total >= 13) return up >= 2 && up <= 6 ? "stand" : "hit";
    if (total === 12) return up >= 4 && up <= 6 ? "stand" : "hit";
    if (total === 11) return legal.canDouble && up !== 11 ? "double" : "hit";
    if (total === 10) return legal.canDouble && up <= 9 ? "double" : "hit";
    if (total === 9) return legal.canDouble && up >= 3 && up <= 6 ? "double" : "hit";
    return "hit";
  }

  test("basic strategy RTP lands near the designed 99.4%", () => {
    const serverSeed = "f".repeat(64);
    const clientSeed = "rtp-sim";
    const ROUNDS = 300000;
    let wagered = 0;
    let returned = 0;

    for (let nonce = 0; nonce < ROUNDS; nonce++) {
      const draw = (cursor) => drawCard(serverSeed, clientSeed, nonce, cursor);
      let state = dealState(100, draw);
      let stake = 100;
      if (state.awaitingInsurance) state = applyInsurance(state, false, draw);
      let guard = 0;
      while (!state.finished && guard++ < 30) {
        const move = chooseMove(state);
        if (move === "double" || move === "split") stake += 100;
        state = applyMove(state, move, draw);
      }
      wagered += stake;
      returned += state.result.totalPayout;
    }

    const rtp = returned / wagered;
    // ~0.6% edge with a 3-sigma band for 300k rounds
    expect(rtp).toBeGreaterThan(0.985);
    expect(rtp).toBeLessThan(1.002);
  }, 120000);
});

describe("bet bounds", () => {
  test("the published limits hold", () => {
    expect(MIN_BET).toBe(1);
    expect(MAX_BET).toBe(100000);
  });
});
