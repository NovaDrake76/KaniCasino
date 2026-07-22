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
  dealerPlay,
  settle,
  replayHand,
} = require("../../utils/blackjackMath");

// card indexes by the fixed mapping: rank = idx % 13 (0 = ace), suit = floor(idx / 13)
const A = 0, TWO = 1, SIX = 5, SEVEN = 6, NINE = 8, TEN = 9, JACK = 10, KING = 12;
const A2 = 13; // ace of hearts

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

describe("naturals", () => {
  test("only a two-card 21 is a natural", () => {
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
});

describe("dealerPlay S17", () => {
  const scripted = (queue) => () => queue.shift();

  test("stands on soft 17 without drawing", () => {
    expect(dealerPlay([A, SIX], scripted([TEN]))).toEqual([A, SIX]);
  });

  test("draws to a soft 17 and stands", () => {
    // A,2 = soft 13 -> draws a 4 -> soft 17 -> stands
    expect(dealerPlay([A, TWO], scripted([3, TEN]))).toEqual([A, TWO, 3]);
  });

  test("draws on hard 16, stands on hard 17", () => {
    expect(dealerPlay([TEN, SIX], scripted([TWO]))).toEqual([TEN, SIX, TWO]);
    expect(dealerPlay([TEN, SEVEN], scripted([TWO]))).toEqual([TEN, SEVEN]);
  });

  test("a bust stops the draw loop", () => {
    const cards = dealerPlay([TEN, SIX], scripted([NINE]));
    expect(handTotal(cards).total).toBeGreaterThan(21);
  });
});

describe("settlement matrix", () => {
  const hand = (cards, bet = 100, doubled = false) => ({ cards, bet, doubled });

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
  ])("%s", (_label, playerHand, dealerCards, outcome, payout) => {
    const result = settle([playerHand], dealerCards);
    expect(result.perHand[0]).toEqual({ outcome, payout });
    expect(result.totalPayout).toBe(payout);
  });
});

describe("replayHand", () => {
  const serverSeed = "c".repeat(64);
  const clientSeed = "replay";

  test("is deterministic and internally consistent for a scripted action list", () => {
    const input = { serverSeed, clientSeed, nonce: 3, betAmount: 100, actions: ["deal", "hit", "stand"] };
    const a = replayHand(input);
    const b = replayHand(input);
    expect(a).toEqual(b);
    expect(a.hands[0].cards).toHaveLength(3);
    expect(a.hands[0].cards[0]).toBe(drawCard(serverSeed, clientSeed, 3, 0));
    expect(a.hands[0].cards[2]).toBe(drawCard(serverSeed, clientSeed, 3, 4));
    expect(a.dealerCards[0]).toBe(drawCard(serverSeed, clientSeed, 3, 1));
    expect(a.dealerCards[1]).toBe(drawCard(serverSeed, clientSeed, 3, 3));
    expect(a.totalPayout).toBe(a.perHand[0].payout);
  });

  test("a double consumes one card, doubles the stake, and ends the hand", () => {
    // find a nonce whose opener is double-legal (no natural on either side)
    let nonce = 0;
    for (; ; nonce++) {
      const p = [drawCard(serverSeed, clientSeed, nonce, 0), drawCard(serverSeed, clientSeed, nonce, 2)];
      const d = [drawCard(serverSeed, clientSeed, nonce, 1), drawCard(serverSeed, clientSeed, nonce, 3)];
      if (!isBlackjack(p) && !isBlackjack(d)) break;
    }
    const out = replayHand({ serverSeed, clientSeed, nonce, betAmount: 50, actions: ["deal", "double"] });
    expect(out.hands[0].cards).toHaveLength(3);
    expect(out.hands[0].doubled).toBe(true);
    expect(out.hands[0].bet).toBe(100);
  });

  test("a dealt natural settles with no further draws regardless of actions", () => {
    let nonce = 0;
    for (; ; nonce++) {
      const p = [drawCard(serverSeed, clientSeed, nonce, 0), drawCard(serverSeed, clientSeed, nonce, 2)];
      if (isBlackjack(p)) break;
    }
    const out = replayHand({ serverSeed, clientSeed, nonce, betAmount: 100, actions: ["deal", "hit", "hit"] });
    expect(out.hands[0].cards).toHaveLength(2);
    expect(out.nextCursor).toBe(4);
    expect(["blackjack", "push"]).toContain(out.perHand[0].outcome);
  });

  test("a busting hit ends the hand with the dealer frozen on two cards", () => {
    // find a nonce where the first hit busts
    let nonce = 0;
    for (; ; nonce++) {
      const p = [drawCard(serverSeed, clientSeed, nonce, 0), drawCard(serverSeed, clientSeed, nonce, 2)];
      const d = [drawCard(serverSeed, clientSeed, nonce, 1), drawCard(serverSeed, clientSeed, nonce, 3)];
      if (isBlackjack(p) || isBlackjack(d)) continue;
      const after = [...p, drawCard(serverSeed, clientSeed, nonce, 4)];
      if (handTotal(after).total > 21) break;
    }
    const out = replayHand({ serverSeed, clientSeed, nonce, betAmount: 100, actions: ["deal", "hit"] });
    expect(out.perHand[0].outcome).toBe("lose");
    expect(out.dealerCards).toHaveLength(2);
    expect(out.totalPayout).toBe(0);
  });
});

describe("bet bounds", () => {
  test("the published limits hold", () => {
    expect(MIN_BET).toBe(1);
    expect(MAX_BET).toBe(100000);
  });
});
