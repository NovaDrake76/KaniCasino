const { isTransient, describeMoneyError, runAtomic } = require("../../utils/economy");

const labelled = (...labels) => {
  const err = new Error("Caused by :: Write conflict during plan execution and yielding is disabled.");
  err.code = 112;
  err.codeName = "WriteConflict";
  err.hasErrorLabel = (l) => labels.includes(l);
  return err;
};

describe("which money failures are safe to run again", () => {
  test("a conflict-aborted transaction is, because nothing committed", () => {
    expect(isTransient(labelled("TransientTransactionError"))).toBe(true);
  });

  test("an unknown commit result is not: it may already have landed", () => {
    expect(isTransient(labelled("UnknownTransactionCommitResult"))).toBe(false);
  });

  test("an unlabelled error is not", () => {
    expect(isTransient(new Error("boom"))).toBe(false);
    expect(isTransient(null)).toBe(false);
    expect(isTransient(undefined)).toBe(false);
  });
});

describe("what gets logged when money rolls back", () => {
  test("one line carrying the code and the labels, not a driver stack", () => {
    const line = describeMoneyError(labelled("TransientTransactionError"));
    expect(line).toContain("WriteConflict");
    expect(line).toContain("code=112");
    expect(line).toContain("labels=TransientTransactionError");
    expect(line.split("\n")).toHaveLength(1);
  });

  test("survives an error with nothing on it", () => {
    expect(describeMoneyError(null)).toBe("unknown");
    expect(describeMoneyError(new Error("plain"))).toContain("plain");
  });
});

describe("runAtomic without transaction support", () => {
  test("still runs the operation and hands back its result", async () => {
    await expect(runAtomic(async () => "done")).resolves.toBe("done");
  });

  test("lets a real failure through rather than swallowing it", async () => {
    await expect(runAtomic(async () => { throw new Error("nope"); })).rejects.toThrow("nope");
  });
});
