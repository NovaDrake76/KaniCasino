const { exec } = require("child_process");
const fs = require("fs");

// the cloudflared tunnel degrades on cloudflare's side, between far-colo ingress and the
// sydney edge servers it pins to. a restart re-rolls which edges it lands on and buys
// minutes to hours. it cures nothing (see .docs/operations.md), so this exists only to
// shorten the outage, and it is rate limited so it cannot become a restart loop.
const COOLDOWN_MS = 15 * 60 * 1000;

// the sudoers entry is NOPASSWD for exactly this path and arguments, so it has to match
const CMD = "sudo -n /usr/bin/systemctl restart cloudflared";

// survives a deploy, which restarts the api and would otherwise reset the cooldown
const stateFile = () => process.env.TUNNEL_STATE_FILE || "/tmp/kani-tunnel-restart";

function lastRestartAt() {
  try {
    return Number(fs.readFileSync(stateFile(), "utf8").trim()) || 0;
  } catch {
    return 0;
  }
}

function record(at) {
  try {
    fs.writeFileSync(stateFile(), String(at));
  } catch (err) {
    console.error("tunnel: could not persist restart time:", err.message);
  }
}

const defaultRun = (cmd) =>
  exec(cmd, (err, _stdout, stderr) => {
    if (err) console.error("tunnel: restart failed:", stderr || err.message);
    else console.log("tunnel: cloudflared restarted");
  });

// a request reaching this process is itself the proof that the origin is healthy, so a
// far-colo probe failing at the same time can only be the path in between.
function requestRestart({ now = Date.now(), run = defaultRun, delayMs = 300, reason = "" } = {}) {
  const last = lastRestartAt();
  const since = now - last;
  if (last && since < COOLDOWN_MS) {
    const retryInMs = COOLDOWN_MS - since;
    console.log(`tunnel: restart refused, ${Math.round(retryInMs / 1000)}s left of cooldown`);
    return { ok: false, reason: "cooldown", retryInMs };
  }

  record(now);
  console.log(`tunnel: restarting cloudflared${reason ? ` (${reason})` : ""}`);
  // the restart drops every tunnel connection including the one carrying this request,
  // so the caller gets its response out first
  setTimeout(() => run(CMD), delayMs);
  return { ok: true, at: now };
}

module.exports = { requestRestart, lastRestartAt, COOLDOWN_MS, CMD };
