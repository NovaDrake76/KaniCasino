import { describe, expect, test } from "vitest";
import {
  cardAria,
  cardValue,
  handTotal,
  isRedSuit,
  outcomeLabel,
  rankLabel,
  suitName,
  totalLabel,
} from "./blackjackCards";

// fixed mapping fixtures: ace of spades 0, ten of spades 9, ace of hearts 13, king of clubs 51
const A = 0, TWO = 1, SIX = 5, NINE = 8, TEN = 9, JACK = 10, A_HEARTS = 13, K_CLUBS = 51;

describe("card decoding", () => {
  test("rank and suit labels follow the backend mapping", () => {
    expect(rankLabel(A)).toBe("A");
    expect(suitName(A)).toBe("spades");
    expect(rankLabel(TEN)).toBe("10");
    expect(rankLabel(JACK)).toBe("J");
    expect(rankLabel(K_CLUBS)).toBe("K");
    expect(suitName(K_CLUBS)).toBe("clubs");
  });

  test("hearts and diamonds are red, spades and clubs are not", () => {
    expect(isRedSuit(A_HEARTS)).toBe(true);
    expect(isRedSuit(26)).toBe(true);
    expect(isRedSuit(A)).toBe(false);
    expect(isRedSuit(K_CLUBS)).toBe(false);
  });

  test("aria labels read naturally", () => {
    expect(cardAria(A_HEARTS)).toBe("ace of hearts");
    expect(cardAria(K_CLUBS)).toBe("king of clubs");
  });
});

describe("hand totals mirror the backend", () => {
  test.each([
    [[A], 11, true],
    [[A, A_HEARTS], 12, true],
    [[A, TEN], 21, true],
    [[A, SIX], 17, true],
    [[A, SIX, TEN], 17, false],
    [[TEN, NINE, A], 20, false],
  ])("%j totals %i (soft %s)", (cards, total, soft) => {
    expect(handTotal(cards as number[])).toEqual({ total, soft });
  });

  test("card values match blackjack rules", () => {
    expect(cardValue(A)).toBe(11);
    expect(cardValue(TWO)).toBe(2);
    expect(cardValue(TEN)).toBe(10);
    expect(cardValue(JACK)).toBe(10);
  });
});

describe("display formatting", () => {
  test("soft hands show both readings until 21", () => {
    expect(totalLabel([A, SIX])).toBe("7/17");
    expect(totalLabel([A, TEN])).toBe("21");
    expect(totalLabel([TEN, NINE])).toBe("19");
    expect(totalLabel([A, SIX, TEN])).toBe("17");
  });

  test("outcome labels cover every backend outcome", () => {
    expect(outcomeLabel("blackjack")).toBe("Blackjack!");
    expect(outcomeLabel("win")).toBe("You win");
    expect(outcomeLabel("push")).toBe("Push");
    expect(outcomeLabel("lose")).toBe("Dealer wins");
    expect(outcomeLabel(null)).toBe("");
  });
});
