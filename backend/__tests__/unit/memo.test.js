const memo = require("../../utils/memo");

// a loader that counts its reads and can be held open, like a slow atlas query
const loader = (values) => {
  let calls = 0;
  const gates = [];
  const fn = () => {
    const value = values[Math.min(calls, values.length - 1)];
    calls += 1;
    return new Promise((resolve) => gates.push(() => resolve(value)));
  };
  return { fn, calls: () => calls, open: () => gates.splice(0).forEach((g) => g()) };
};

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => memo.clear());
afterEach(() => jest.useRealTimers());

describe("a remembered public read", () => {
  it("reads once for everybody who asks while it is loading", async () => {
    const l = loader(["cases"]);
    const a = memo.remember("cases:list", 30000, l.fn);
    const b = memo.remember("cases:list", 30000, l.fn);
    l.open();
    expect(await a).toBe("cases");
    expect(await b).toBe("cases");
    expect(l.calls()).toBe(1);
  });

  it("answers from the copy until it expires, then serves the old copy while it refreshes", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] });
    const l = loader(["old", "new"]);
    const first = memo.remember("cases:list", 30000, l.fn);
    l.open();
    await first;

    jest.advanceTimersByTime(10000);
    expect(await memo.remember("cases:list", 30000, l.fn)).toBe("old");
    expect(l.calls()).toBe(1);

    jest.advanceTimersByTime(25000);
    expect(await memo.remember("cases:list", 30000, l.fn)).toBe("old");
    expect(l.calls()).toBe(2);
    l.open();
    await flush();
    expect(await memo.remember("cases:list", 30000, l.fn)).toBe("new");
  });

  it("forgets a copy the moment the data is written, so the next reader sees the write", async () => {
    const l = loader(["before", "after"]);
    const first = memo.remember("cases:list", 60000, l.fn);
    l.open();
    await first;

    memo.forget("cases:");
    const next = memo.remember("cases:list", 60000, l.fn);
    l.open();
    expect(await next).toBe("after");
  });

  it("does not keep what a read saw if a write landed while it was in flight", async () => {
    const l = loader(["before", "after"]);
    const racing = memo.remember("cases:list", 60000, l.fn);
    memo.forget("cases:");
    l.open();
    await racing;

    const next = memo.remember("cases:list", 60000, l.fn);
    l.open();
    expect(await next).toBe("after");
    expect(l.calls()).toBe(2);
  });

  it("leaves other prefixes alone when it forgets", async () => {
    const cases = loader(["cases"]);
    const fandom = loader(["boards"]);
    const a = memo.remember("cases:list", 60000, cases.fn);
    const b = memo.remember("fandom:1", 60000, fandom.fn);
    cases.open();
    fandom.open();
    await Promise.all([a, b]);

    memo.forget("cases:");
    expect(await memo.remember("fandom:1", 60000, fandom.fn)).toBe("boards");
    expect(fandom.calls()).toBe(1);
  });

  it("does not remember a failed read", async () => {
    let calls = 0;
    const fn = () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("atlas timeout")) : Promise.resolve("ok");
    };
    await expect(memo.remember("cases:list", 60000, fn)).rejects.toThrow("atlas timeout");
    expect(await memo.remember("cases:list", 60000, fn)).toBe("ok");
  });

  it("keeps at most a bounded number of copies, dropping the oldest", async () => {
    for (let i = 0; i <= memo.MAX_ENTRIES; i++) await memo.remember(`fandom:q${i}`, 60000, async () => i);
    let reread = false;
    await memo.remember("fandom:q0", 60000, async () => {
      reread = true;
      return 0;
    });
    expect(reread).toBe(true);
  });
});
