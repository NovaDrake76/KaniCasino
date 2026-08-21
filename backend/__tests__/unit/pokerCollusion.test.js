const { analyse, skew, clinginess, pairsFrom } = require("../../utils/pokerCollusion");

// one hand between two seats: `won` is what each took out, `put` what each put in
const hand = (a, b, wonA, putA, wonB, putB, tableId = "t1") => ({
  tableId,
  players: [
    { userId: a, wonChips: wonA, totalCommitted: putA },
    { userId: b, wonChips: wonB, totalCommitted: putB },
  ],
});

// an even game: they trade the pot back and forth
const evenGame = (n, a = "A", b = "B", tableId = "t1") =>
  Array.from({ length: n }, (_, i) =>
    i % 2 === 0 ? hand(a, b, 100, 50, 0, 50, tableId) : hand(a, b, 0, 50, 100, 50, tableId)
  );

// a dump: one side folds everything away
const dump = (n, a = "A", b = "B", tableId = "t1") =>
  Array.from({ length: n }, () => hand(a, b, 200, 100, 0, 100, tableId));

describe("skew", () => {
  it("reads an even game as even", () => {
    const { pairs } = pairsFrom(evenGame(20));
    expect(skew([...pairs.values()][0]).share).toBeCloseTo(0.5, 2);
  });

  it("reads a one-sided flow as one-sided", () => {
    const { pairs } = pairsFrom(dump(20));
    const result = skew([...pairs.values()][0]);
    expect(result.share).toBe(1);
    expect(result.towards === undefined || result.to === "A").toBe(true);
  });

  it("survives a pair who never won anything", () => {
    const { pairs } = pairsFrom([hand("A", "B", 0, 0, 0, 0)]);
    expect(skew([...pairs.values()][0]).share).toBe(0.5);
  });
});

describe("playing nobody else", () => {
  it("spots a pair who only ever meet each other", () => {
    const { pairs, handsPerUser } = pairsFrom(evenGame(30));
    expect(clinginess([...pairs.values()][0], handsPerUser)).toBe(1);
  });

  it("does not flag a pair who both play a wide field", () => {
    const hands = [
      ...evenGame(10, "A", "B"),
      ...evenGame(20, "A", "C"),
      ...evenGame(20, "B", "D"),
    ];
    const { pairs, handsPerUser } = pairsFrom(hands);
    const ab = [...pairs.values()].find((p) => p.id === "A|B");
    expect(clinginess(ab, handsPerUser)).toBeLessThan(0.5);
  });
});

describe("the report", () => {
  it("says nothing about an even game between two regulars", () => {
    const hands = [...evenGame(40, "A", "B"), ...evenGame(40, "A", "C"), ...evenGame(40, "B", "C")];
    expect(analyse(hands)).toEqual([]);
  });

  it("flags a one-sided flow", () => {
    const flagged = analyse(dump(40));
    expect(flagged).toHaveLength(1);
    expect(flagged[0].reasons).toContain("lopsided");
    expect(flagged[0].towards).toBe("A");
    expect(flagged[0].users.sort()).toEqual(["A", "B"]);
  });

  it("flags a pair who only ever play each other, even at even money", () => {
    const flagged = analyse(evenGame(40));
    expect(flagged).toHaveLength(1);
    expect(flagged[0].reasons).toContain("only-each-other");
    expect(flagged[0].reasons).not.toContain("lopsided");
  });

  // a pair who have barely met have no numbers worth reading
  it("ignores a pair below the hand threshold", () => {
    expect(analyse(dump(5))).toEqual([]);
  });

  it("puts the biggest one-sided flow first", () => {
    const hands = [
      ...dump(30, "A", "B"),
      ...Array.from({ length: 30 }, () => hand("C", "D", 20, 10, 0, 10)),
    ];
    const flagged = analyse(hands);
    expect(flagged[0].users).toContain("A");
    expect(flagged[0].volume).toBeGreaterThan(flagged[1].volume);
  });

  it("counts how many tables a pair met at", () => {
    const hands = [...dump(20, "A", "B", "t1"), ...dump(20, "A", "B", "t2")];
    expect(analyse(hands)[0].tables).toBe(2);
  });

  it("reads a three handed table without inventing pairs", () => {
    const three = Array.from({ length: 30 }, () => ({
      tableId: "t1",
      players: [
        { userId: "A", wonChips: 90, totalCommitted: 30 },
        { userId: "B", wonChips: 0, totalCommitted: 30 },
        { userId: "C", wonChips: 0, totalCommitted: 30 },
      ],
    }));
    const { pairs } = pairsFrom(three);
    expect([...pairs.keys()].sort()).toEqual(["A|B", "A|C", "B|C"]);
  });

  it("ignores an empty seat", () => {
    const { pairs } = pairsFrom([
      { tableId: "t", players: [{ userId: "A", wonChips: 1, totalCommitted: 0 }, { userId: null }] },
    ]);
    expect(pairs.size).toBe(0);
  });
});
