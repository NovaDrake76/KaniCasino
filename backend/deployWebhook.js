const crypto = require("crypto");
const os = require("os");
const { exec } = require("child_process");

// receives GitHub push webhooks and triggers the deploy script. mounted before
// the CORS / api-key gates (GitHub sends neither), so its own HMAC check is the
// only thing that authorizes it. it never runs anything but the fixed deploy
// script, so the worst a forged request could do is trigger a redeploy of main.
const githubDeployHandler = (req, res) => {
  const secret = process.env.DEPLOY_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).send("deploy webhook not configured");
  }

  const signature = req.headers["x-hub-signature-256"];
  // req.body is a Buffer here (mounted with express.raw)
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(req.body).digest("hex");

  const sigBuf = Buffer.from(signature || "", "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(401).send("bad signature");
  }

  const event = req.headers["x-github-event"];
  if (event === "ping") {
    return res.status(200).send("pong");
  }

  let payload = {};
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch (err) {
    return res.status(400).send("bad payload");
  }

  if (event !== "push" || payload.ref !== "refs/heads/main") {
    return res.status(202).send("ignored");
  }

  res.status(202).send("deploying");

  // run fully detached (new session) so the backend restart inside the deploy
  // script can't kill the deploy mid-flight
  const script = `${os.homedir()}/deploy-kani.sh`;
  exec(`setsid bash ${script} >> ${os.homedir()}/deploy-kani.log 2>&1 &`, {
    detached: true,
  });
};

module.exports = { githubDeployHandler };
