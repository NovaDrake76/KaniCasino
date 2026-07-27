const fs = require("fs");
const os = require("os");
const path = require("path");

let tunnel;
let stateFile;

beforeEach(() => {
  stateFile = path.join(os.tmpdir(), `tunnel-state-${Date.now()}-${Math.random()}`);
  process.env.TUNNEL_STATE_FILE = stateFile;
  jest.resetModules();
  tunnel = require("../../utils/tunnel");
});

afterEach(() => {
  try {
    fs.unlinkSync(stateFile);
  } catch {
    // never written, which is the case in the refusal tests
  }
  delete process.env.TUNNEL_STATE_FILE;
});

const settle = () => new Promise((r) => setTimeout(r, 5));

describe("asking for a restart", () => {
  it("runs the command the sudoers entry allows, and nothing else", async () => {
    const ran = [];
    tunnel.requestRestart({ run: (c) => ran.push(c), delayMs: 0 });
    await settle();

    expect(ran).toEqual(["sudo -n /usr/bin/systemctl restart cloudflared"]);
  });

  it("answers before it restarts, because the restart kills the caller's connection", async () => {
    const ran = [];
    const result = tunnel.requestRestart({ run: (c) => ran.push(c), delayMs: 5 });

    expect(result.ok).toBe(true);
    expect(ran).toHaveLength(0); // the caller already has its answer

    await new Promise((r) => setTimeout(r, 15));
    expect(ran).toHaveLength(1);
  });
});

describe("the cooldown", () => {
  it("refuses a second restart inside fifteen minutes", async () => {
    const ran = [];
    const now = Date.now();
    tunnel.requestRestart({ now, run: (c) => ran.push(c), delayMs: 0 });
    await settle();

    const second = tunnel.requestRestart({ now: now + 60000, run: (c) => ran.push(c), delayMs: 0 });
    await settle();

    expect(second.ok).toBe(false);
    expect(second.reason).toBe("cooldown");
    expect(ran).toHaveLength(1);
  });

  it("reports how long is left, so the caller can say why it was skipped", () => {
    const now = Date.now();
    tunnel.requestRestart({ now, run: () => {}, delayMs: 0 });

    const second = tunnel.requestRestart({ now: now + 5 * 60000, run: () => {}, delayMs: 0 });

    expect(second.retryInMs).toBe(10 * 60000);
  });

  it("allows the next one once the window has passed", async () => {
    const ran = [];
    const now = Date.now();
    tunnel.requestRestart({ now, run: (c) => ran.push(c), delayMs: 0 });
    await settle();

    const later = tunnel.requestRestart({
      now: now + tunnel.COOLDOWN_MS + 1000,
      run: (c) => ran.push(c),
      delayMs: 0,
    });
    await settle();

    expect(later.ok).toBe(true);
    expect(ran).toHaveLength(2);
  });

  // a deploy restarts the api, and an in-memory cooldown would reset with it, which is
  // exactly when a flapping probe could cause a restart loop
  it("survives the process restarting", async () => {
    const now = Date.now();
    tunnel.requestRestart({ now, run: () => {}, delayMs: 0 });
    await settle();

    jest.resetModules();
    const reloaded = require("../../utils/tunnel");
    const second = reloaded.requestRestart({ now: now + 60000, run: () => {}, delayMs: 0 });

    expect(second.ok).toBe(false);
    expect(second.reason).toBe("cooldown");
  });

  it("still restarts when the state file cannot be read", async () => {
    process.env.TUNNEL_STATE_FILE = path.join(os.tmpdir(), "no", "such", "dir", "state");
    jest.resetModules();
    const isolated = require("../../utils/tunnel");

    const ran = [];
    const result = isolated.requestRestart({ run: (c) => ran.push(c), delayMs: 0 });
    await settle();

    expect(result.ok).toBe(true);
    expect(ran).toHaveLength(1);
  });
});

// the endpoint must sit above the api-key gate: the probe runs from a github runner and
// carries no api key, only the maintenance token
describe("where the endpoint is mounted", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../index.js"), "utf8");

  it("is above the gate", () => {
    const endpoint = source.indexOf('app.post("/internal/tunnel-restart"');
    const gate = source.indexOf("app.use(checkApiKey)");
    expect(endpoint).toBeGreaterThan(-1);
    expect(endpoint).toBeLessThan(gate);
  });

  it("is behind the maintenance token", () => {
    const endpoint = source.indexOf('app.post("/internal/tunnel-restart"');
    const handler = source.slice(endpoint, endpoint + 500);
    expect(handler).toContain("MAINT_TOKEN");
    expect(handler).toContain("x-maint-token");
    expect(handler).toContain("403");
  });
});
