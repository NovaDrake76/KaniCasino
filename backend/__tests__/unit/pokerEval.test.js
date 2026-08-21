const { cardFromName, cardName, shuffle, deal, DECK } = require("../../utils/pokerCards");
const { evaluate, bestSeats, CATEGORY, CATEGORY_NAME } = require("../../utils/pokerEval");

const hand = (str) => str.split(" ").map(cardFromName);
const cat = (str) => evaluate(hand(str)).category;
const score = (str) => evaluate(hand(str)).score;

describe("categories", () => {
  it("names every category from a seven card hand", () => {
    expect(cat("As Ks Qs Js Ts 2h 3d")).toBe(CATEGORY.STRAIGHT_FLUSH);
    expect(cat("9s 8s 7s 6s 5s Kh Qd")).toBe(CATEGORY.STRAIGHT_FLUSH);
    expect(cat("As Ah Ad Ac Kh Qd 2s")).toBe(CATEGORY.QUADS);
    expect(cat("As Ah Ad Kc Kh Qd 2s")).toBe(CATEGORY.FULL_HOUSE);
    expect(cat("As Ks 9s 5s 2s Qd 3h")).toBe(CATEGORY.FLUSH);
    expect(cat("9s 8h 7d 6c 5s Kh Qd")).toBe(CATEGORY.STRAIGHT);
    expect(cat("As Ah Ad Kc Qh 9d 2s")).toBe(CATEGORY.TRIPS);
    expect(cat("As Ah Kd Kc Qh 9d 2s")).toBe(CATEGORY.TWO_PAIR);
    expect(cat("As Ah Kd Qc Jh 9d 2s")).toBe(CATEGORY.PAIR);
    expect(cat("As Kh Qd Jc 9h 7d 2s")).toBe(CATEGORY.HIGH_CARD);
  });

  it("orders the categories", () => {
    const ladder = [
      "As Kh Qd Jc 9h 7d 2s",
      "As Ah Kd Qc Jh 9d 2s",
      "As Ah Kd Kc Qh 9d 2s",
      "As Ah Ad Kc Qh 9d 2s",
      "9s 8h 7d 6c 5s Kh Qd",
      "As Ks 9s 5s 2s Qd 3h",
      "As Ah Ad Kc Kh Qd 2s",
      "As Ah Ad Ac Kh Qd 2s",
      "As Ks Qs Js Ts 2h 3d",
    ];
    const scores = ladder.map(score);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
  });
});

describe("straights", () => {
  it("reads the wheel, and ranks it below every other straight", () => {
    expect(cat("As 2h 3d 4c 5s Kh Qd")).toBe(CATEGORY.STRAIGHT);
    expect(score("As 2h 3d 4c 5s Kh Qd")).toBeLessThan(score("2s 3h 4d 5c 6s Kh Qd"));
  });

  it("reads the steel wheel as a straight flush", () => {
    expect(cat("As 2s 3s 4s 5s Kh Qd")).toBe(CATEGORY.STRAIGHT_FLUSH);
    expect(score("As 2s 3s 4s 5s Kh Qd")).toBeLessThan(score("6s 2s 3s 4s 5s Kh Qd"));
  });

  it("takes the highest run when six cards connect", () => {
    const { kickers } = evaluate(hand("9h 8d 7c 6s 5h 4d Kc"));
    expect(kickers[0]).toBe(7); // rank 7 is the nine
  });

  // the wheel is the one hand where the ace does not play as the top card
  it("does not let an ace bridge king and deuce", () => {
    expect(cat("Ks Ah 2d 3c 4s 9h 8d")).not.toBe(CATEGORY.STRAIGHT);
  });
});

describe("flushes", () => {
  it("keeps only the top five of a six card flush", () => {
    const { kickers } = evaluate(hand("As Ks 9s 5s 2s 3s Qd"));
    expect(kickers).toEqual([12, 11, 7, 3, 1]);
  });

  it("loses to a full house", () => {
    expect(score("As Ks 9s 5s 2s Qd 3h")).toBeLessThan(score("As Ah Ad Kc Kh Qd 2s"));
  });

  // a flush in one suit does not make a straight flush out of a straight in another
  it("does not confuse a flush and an offsuit straight for a straight flush", () => {
    const h = evaluate(hand("9h 8d 7c 6s 5h 2h 3h"));
    expect(h.category).toBe(CATEGORY.STRAIGHT);
  });
});

describe("kickers", () => {
  it("splits two pair on the fifth card", () => {
    expect(score("As Ah Kd Kc Qh 2d 3s")).toBeGreaterThan(score("As Ah Kd Kc Jh 2d 3s"));
  });

  it("splits one pair on the third kicker", () => {
    expect(score("As Ah Kd Qc 9h 2d 3s")).toBeGreaterThan(score("As Ah Kd Qc 8h 2d 3s"));
  });

  it("splits quads on the kicker", () => {
    expect(score("As Ah Ad Ac Kh 2d 3s")).toBeGreaterThan(score("As Ah Ad Ac Qh 2d 3s"));
  });

  it("plays the better of two trips as the pair in a full house", () => {
    const h = evaluate(hand("As Ah Ad Kc Kh Ks 2d"));
    expect(h.category).toBe(CATEGORY.FULL_HOUSE);
    expect(h.kickers).toEqual([12, 11]);
  });

  it("ignores a sixth card that cannot play", () => {
    expect(score("As Ah Kd Qc 9h 2d 3s")).toBe(score("As Ah Kd Qc 9h 4d 5s"));
  });
});

describe("showdown", () => {
  it("finds the single winner", () => {
    const board = hand("Ah Kd 7c 2s 9h");
    const { winners } = bestSeats({
      0: [...board, ...hand("As Ac")],
      1: [...board, ...hand("Kh Kc")],
    });
    expect(winners).toEqual([0]);
  });

  it("splits when the board plays for both", () => {
    const board = hand("As Ks Qs Js Ts");
    const { winners } = bestSeats({
      0: [...board, ...hand("2h 3d")],
      1: [...board, ...hand("4h 5d")],
    });
    expect(winners).toEqual([0, 1]);
  });

  it("splits an identical two pair with the same kicker", () => {
    const board = hand("Ah Ad Kh Kd 9c");
    const { winners } = bestSeats({
      0: [...board, ...hand("2h 3d")],
      1: [...board, ...hand("4h 5d")],
    });
    expect(winners).toEqual([0, 1]);
  });

  it("does not split when one player's hole card beats the board", () => {
    const board = hand("Ah Ad Kh Kd 9c");
    const { winners } = bestSeats({
      0: [...board, ...hand("Qh Qd")],
      1: [...board, ...hand("4h 5d")],
    });
    expect(winners).toEqual([0]);
  });
});

describe("category names", () => {
  it("has a label for every category", () => {
    expect(CATEGORY_NAME).toHaveLength(9);
    expect(CATEGORY_NAME[CATEGORY.STRAIGHT_FLUSH]).toBe("Straight flush");
  });
});

describe("shuffle", () => {
  it("is a permutation of the whole deck", () => {
    const deck = shuffle("server", "client", 1);
    expect(deck).toHaveLength(DECK);
    expect(new Set(deck).size).toBe(DECK);
    expect(Math.min(...deck)).toBe(0);
    expect(Math.max(...deck)).toBe(DECK - 1);
  });

  it("is deterministic from the seed material", () => {
    expect(shuffle("server", "client", 7)).toEqual(shuffle("server", "client", 7));
    expect(shuffle("server", "client", 7)).not.toEqual(shuffle("server", "client", 8));
    expect(shuffle("server", "client", 7)).not.toEqual(shuffle("other", "client", 7));
    expect(shuffle("server", "client", 7)).not.toEqual(shuffle("server", "other", 7));
  });

  it("deals every player and the board distinct cards", () => {
    const deck = shuffle("s", "c", 1);
    const dealt = deal(deck, 6);
    const all = [...dealt.holes.flat(), ...dealt.flop, dealt.turn, dealt.river];
    expect(all).toHaveLength(17);
    expect(new Set(all).size).toBe(17);
  });

  // a biased shuffle is the kind of bug that hides for months, so check the deck is not
  // sticky at any position across many hands
  it("moves every position around across many hands", () => {
    const seen = new Map();
    for (let handNumber = 0; handNumber < 400; handNumber++) {
      const deck = shuffle("server", "client", handNumber);
      for (let pos = 0; pos < 5; pos++) {
        const key = `${pos}`;
        if (!seen.has(key)) seen.set(key, new Set());
        seen.get(key).add(deck[pos]);
      }
    }
    for (const cards of seen.values()) expect(cards.size).toBeGreaterThan(30);
  });
});

describe("card naming", () => {
  it("round trips", () => {
    for (let card = 0; card < DECK; card++) {
      expect(cardFromName(cardName(card))).toBe(card);
    }
  });
});
