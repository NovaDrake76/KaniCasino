// a read that has not answered by now is most likely stuck on a bad route between cloudflare
// and the server, not slow at the server: a second copy goes out and the first answer wins
export const HEDGE_MS = 2500;
// a cap on the extra copies a tab sends, so a server that is itself slow gets a few more reads rather than every read twice
export const HEDGE_BUDGET = 4;
export const HEDGE_WINDOW_MS = 10000;

const answered = (err: unknown) => !!(err && typeof err === "object" && "response" in err && (err as { response?: unknown }).response);

export function createHedger({ delay = HEDGE_MS, budget = HEDGE_BUDGET, windowMs = HEDGE_WINDOW_MS } = {}) {
  let spent: number[] = [];
  const mayCopy = () => {
    const now = Date.now();
    spent = spent.filter((t) => now - t < windowMs);
    if (spent.length >= budget) return false;
    spent.push(now);
    return true;
  };

  // only for requests that can safely run twice. send gets its own signal per copy, so the
  // loser is cancelled the moment the winner lands.
  return function hedged<T>(send: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const copies: AbortController[] = [];
      let done = false;
      let failed = 0;
      let firstError: unknown;

      const finish = (settle: () => void) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        copies.forEach((c) => c.abort());
        settle();
      };

      const fire = () => {
        const copy = new AbortController();
        copies.push(copy);
        send(copy.signal).then(
          (value) => finish(() => resolve(value)),
          (err) => {
            if (done) return;
            failed += 1;
            if (failed === 1) firstError = err;
            if (failed < copies.length) return;
            // the server's own answer is final, an error included; only silence earns a second copy
            if (copies.length === 1 && !answered(err) && mayCopy()) {
              clearTimeout(timer);
              fire();
            } else finish(() => reject(firstError));
          }
        );
      };

      fire();
      const timer = setTimeout(() => {
        if (!done && copies.length === 1 && mayCopy()) fire();
      }, delay);
    });
  };
}

export const hedged = createHedger();
