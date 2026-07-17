const { sha256 } = require("../../utils/hashChain");

let mockCrashSeed = null;
jest.mock("../../utils/gameChain", () => ({
  consumeNextSeed: jest.fn(async () => ({ seed: mockCrashSeed, chainId: "c", index: 0 })),
}));

jest.mock("../../models/Round", () => ({
  create: jest.fn(async (doc) => ({ _id: "round-under-test", ...doc })),
  updateOne: jest.fn(async () => ({})),
}));

jest.mock("../../utils/economy", () => ({
  chargeUser: jest.fn(), creditUser: jest.fn(),
  TX: { CRASH_BET: "crash_bet", CRASH_CASHOUT: "crash_cashout" },
}));

const crashGame = require("../../games/crash");
mockCrashSeed = sha256("crash-sync-fixture");

const makeIo = () => {
  const io = {
    connection: null,
    on: (event, fn) => { if (event === "connection") io.connection = fn; },
    emit: () => {},
    to: () => ({ emit: () => {} }),
  };
  return io;
};

// a socket that records what the server emits to it, and lets a handler be invoked
const makeSocket = () => {
  const handlers = {};
  const emitted = [];
  return { emitted, handlers, on: (e, fn) => { handlers[e] = fn; }, emit: (e, p) => emitted.push({ e, p }) };
};

describe("crash sync on entry", () => {
  let io;
  beforeEach(async () => {
    jest.useFakeTimers();
    io = makeIo();
    crashGame(io);
    await jest.advanceTimersByTimeAsync(0); // betting opens
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

  test("a connecting socket is told the current phase, without the crash point", async () => {
    const socket = makeSocket();
    io.connection(socket);

    const sync = socket.emitted.find((m) => m.e === "crash:sync");
    expect(sync).toBeTruthy();
    expect(sync.p.phase).toBe("betting");
    expect(sync.p).not.toHaveProperty("crashPoint");
  });

  test("phase is running once the round starts, and a request re-sends it", async () => {
    const socket = makeSocket();
    io.connection(socket);
    await jest.advanceTimersByTimeAsync(12000); // betting closes, the round runs

    socket.emitted.length = 0;
    socket.handlers["crash:requestState"](); // a joiner asks for the state

    const sync = socket.emitted.find((m) => m.e === "crash:sync");
    expect(sync.p.phase).toBe("running");
    expect(sync.p.gameStartTime).toBeTruthy();
    expect(sync.p).not.toHaveProperty("crashPoint");
  });
});
