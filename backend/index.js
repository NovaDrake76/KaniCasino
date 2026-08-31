const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const socketIO = require("socket.io");
const cronJobs = require("./tasks/cronJobs");
const checkApiKey = require("./middleware/checkApiKey");
const tunnel = require("./utils/tunnel");
const { socketAuth } = require("./middleware/socketAuth");
const realtime = require("./utils/realtime");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

// deploy webhook is mounted first, with a raw body parser, so it bypasses the
// CORS + api-key gates below (GitHub sends neither) and can verify its own HMAC
const { githubDeployHandler } = require("./deployWebhook");
app.post("/deploy/github", express.raw({ type: "*/*" }), githubDeployHandler);

// public liveness probe (also bypasses the api-key gate so monitors can hit it)
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// discord redirects the player's browser back here after they approve the link, so it
// arrives with no api key and no token. it verifies its own signed state instead.
app.get("/discord/oauth/callback", require("./routes/discordRoutes").oauthCallback);

const isDevelopment = process.env.NODE_ENV === "development";

// allowed origins are configurable via ALLOWED_ORIGINS (comma-separated); falls
// back to the production domain so behaviour is unchanged when it isn't set
const { parseOrigins, originAllowed, PREFLIGHT_MAX_AGE } = require("./utils/cors");
const allowedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);

const isOriginAllowed = (origin) => originAllowed(origin, { isDevelopment, allowedOrigins });

const corsOrigin = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
  } else {
    callback(new Error("Not allowed by CORS"));
  }
};

const corsOptions = {
  origin: corsOrigin,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true,
  maxAge: PREFLIGHT_MAX_AGE,
};

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.status(403).send("Not allowed by CORS");
    return;
  }

  next();
});

const io = socketIO(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  },
});
realtime.setIo(io);

const coinFlip = require("./games/coinFlip");
const crash = require("./games/crash");
const caseBattle = require("./games/caseBattle");
const { recoverStuckRounds } = require("./utils/rounds");
const { completeStuckBattles } = require("./games/battleEngine");
const { sweepBlackjackHands } = require("./games/blackjack");
const { sweepMinesGames } = require("./games/mines");
const { sweepHiloGames } = require("./games/hilo");
const { sweepSettlements } = require("./utils/predictionSettlement");
const { sweepBoards } = require("./utils/leaderboard");
const liveFeed = require("./utils/liveFeed");
const chat = require("./utils/chat");
const rain = require("./utils/rain");
const { probeTransactions, setTransactionsSupported } = require("./utils/economy");
const userRoutes = require("./routes/userRoutes");
const caseRoutes = require("./routes/caseRoutes");
const itemRoutes = require("./routes/itemRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes")(io);
const adminRoutes = require("./routes/adminRoutes");
const gamesRoutes = require("./routes/gamesRoutes")(io);
const friendsRoutes = require("./routes/friendsRoutes")(io);
const fairRoutes = require("./routes/fairRoutes");
const collectionsRoutes = require("./routes/collectionsRoutes");
const missionsRoutes = require("./routes/missionsRoutes")(io);
const referralRoutes = require("./routes/referralRoutes")(io);
const rewardRoutes = require("./routes/rewardRoutes")(io);
const giftRoutes = require("./routes/giftRoutes");
const emailRoutes = require("./routes/emailRoutes");
const fandomRoutes = require("./routes/fandomRoutes");
const predictionRoutes = require("./routes/predictionRoutes")(io);
const discordRoutes = require("./routes/discordRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // useCreateIndex: true,
  })
  .then(async () => {
    console.log("MongoDB connected");
    // money writes are only atomic where transactions exist; refuse to run prod without
    const ok = await probeTransactions();
    setTransactionsSupported(ok);
    if (!ok) {
      if (process.env.NODE_ENV === "production") {
        console.error("mongo is not a replica set: money writes cannot be atomic, refusing to start");
        process.exit(1);
      }
      console.warn("mongo is not a replica set: money writes are best-effort (dev only)");
    }
  })
  .catch((err) => console.log(err));

// Middleware
app.use(express.json());
app.use(cors(corsOptions));

// internal ops hook: the tunnel watchdog announces an imminent reconnect so clients can
// toast it before cloudflared re-rolls. token-gated, bypasses the api-key gate, never public.
app.post("/internal/notice", (req, res) => {
  if (!process.env.MAINT_TOKEN || req.headers["x-maint-token"] !== process.env.MAINT_TOKEN) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { message, seconds } = req.body || {};
  io.emit("serverNotice", { message, seconds });
  res.json({ ok: true });
});

// the uptime workflow probes from a non-sydney colo, which is the only vantage that can
// see the tunnel degrade, and asks for a restart when it does. reaching this handler at
// all proves the origin is up, so the fault is the path in between.
app.post("/internal/tunnel-restart", (req, res) => {
  if (!process.env.MAINT_TOKEN || req.headers["x-maint-token"] !== process.env.MAINT_TOKEN) {
    return res.status(403).json({ error: "forbidden" });
  }
  const result = tunnel.requestRestart({ reason: String(req.body?.reason || "").slice(0, 200) });
  res.status(result.ok ? 202 : 429).json(result);
});

// SNS and mail clients hitting the one-click unsubscribe carry no api key, so this
// mounts above the gate. everything inside that touches a session still needs a JWT.
app.use("/email", emailRoutes);

// block requests from outside
app.use(checkApiKey);

// Routes
// app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/cases", caseRoutes);
app.use("/items", itemRoutes);
app.use("/marketplace", marketplaceRoutes);
app.use("/admin", adminRoutes);
app.use("/games", gamesRoutes);
app.use("/friends", friendsRoutes);
app.use("/fair", fairRoutes);
app.use("/collections", collectionsRoutes);
app.use("/missions", missionsRoutes);
app.use("/referrals", referralRoutes);
app.use("/rewards", rewardRoutes);
app.use("/gift", giftRoutes);
app.use("/fandom", fandomRoutes);
app.use("/predictions", predictionRoutes);
app.use("/discord", discordRoutes);
app.use("/leaderboard", leaderboardRoutes);

// settle whatever the last shutdown interrupted before dealing anyone in again: a live
// crash or coin flip round holds real stakes, and until this runs they are unaccounted.
// it repeats because a give-back loop that dies holds its lease until that goes stale,
// and a boot-only sweep would leave the money it still owes until the next restart.
// boot recovers live-looking rounds/battles the restart orphaned; the interval only
// resumes a give-back loop that died holding a stale lease, so it never touches the
// rounds the running game loops are still playing.
const sweepRounds = ({ boot = false } = {}) => {
  recoverStuckRounds(io, coinFlip.winPayout, { boot }).catch((e) => console.log(e));
  completeStuckBattles(io, { boot }).catch((e) => console.log(e));
  sweepBlackjackHands(io).catch((e) => console.log(e));
  sweepMinesGames(io).catch((e) => console.log(e));
  sweepHiloGames(io).catch((e) => console.log(e));
  sweepSettlements(io).catch((e) => console.log(e));
  sweepBoards(io).catch((e) => console.log(e));
};
liveFeed.seed().then((n) => n && console.log(`live feed seeded: ${n} rows`)).catch(() => {});
// the rain settles on a timer rather than a schedule, so a restart mid round pays it the
// moment it comes back instead of skipping it
rain.start();
sweepRounds({ boot: true });
setInterval(() => sweepRounds({ boot: false }), 5 * 60 * 1000);

// Start the games
const stopCoinFlip = coinFlip(io);
const stopCrash = crash(io);
caseBattle(io);

// Start the cron jobs
cronJobs.startCronJobs(io);
adminRoutes.attachPredictionSettlement(io);

// every deploy used to kill a live round and leave the stakes to the next boot's sweep.
// settling here instead is the same code on a round that is one, not a backlog, and the
// players are still connected, so the refund actually reaches them. pm2 sends SIGINT and
// waits kill_timeout before SIGKILL, so this is best-effort by design: whatever it does
// not finish is still marked unfinished, and the boot sweep picks it up as before.
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: closing betting and settling the live rounds`);
  try {
    await Promise.all([stopCrash(), stopCoinFlip()]);
    await recoverStuckRounds(io, coinFlip.winPayout, { boot: true });
  } catch (e) {
    console.log("shutdown settle did not finish, the boot sweep will:", e);
  }
  server.close();
  try {
    await mongoose.connection.close();
  } catch (e) {
    // nothing left to do about it, we are on the way out
  }
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const port = process.env.PORT || 5000;

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

let onlineUsers = 0;

// optional auth: a valid token binds socket.userId; anonymous sockets may still
// watch games but the game handlers ignore any client-supplied identity.
io.use(socketAuth);

io.on("connection", (socket) => {
  onlineUsers++;
  io.emit("onlineUsers", onlineUsers);

  // the ticker is in memory, so a joiner gets what is there rather than an empty table.
  // it is also on request: the socket connects when the app boots, long before a game
  // page mounts the table, so the connect-time copy alone always arrived to no listener.
  const sendRecent = () => socket.emit("liveBet:recent", liveFeed.recent());
  sendRecent();
  socket.on("liveBet:request", sendRecent);

  // the chat asks for its history rather than being pushed it, for the same reason: the
  // socket connects at app boot and the panel mounts whenever the player opens it
  socket.on("chat:request", async () => {
    try {
      socket.emit("chat:recent", await chat.recent());
    } catch (err) {
      socket.emit("chat:recent", []);
    }
  });

  socket.on("chat:send", async (payload, ack) => {
    const done = typeof ack === "function" ? ack : () => {};
    try {
      const text = typeof payload === "string" ? payload : payload && payload.text;
      const result = await chat.send(socket.userId, text);
      done(result.error ? { error: result.error, minLevel: result.minLevel } : { ok: true });
    } catch (err) {
      console.error("chat send:", err.message);
      done({ error: "failed" });
    }
  });

  socket.on("rain:request", async () => {
    try {
      socket.emit("rain:state", await rain.state(socket.userId));
    } catch (err) {
      // a rain panel that cannot load is not worth failing a socket over
    }
  });

  socket.on("rain:join", async (_payload, ack) => {
    const done = typeof ack === "function" ? ack : () => {};
    try {
      const result = await rain.join(socket.userId);
      done(result);
    } catch (err) {
      console.error("rain join:", err.message);
      done({ error: "failed" });
    }
  });

  socket.on("chat:report", async (payload, ack) => {
    const done = typeof ack === "function" ? ack : () => {};
    try {
      const result = await chat.report(socket.userId, payload && payload.id, payload && payload.reason);
      done(result.error ? { error: result.error } : { ok: true });
    } catch (err) {
      done({ error: "failed" });
    }
  });

  // join the authenticated user's private room for targeted updates
  if (socket.userId) {
    socket.join(socket.userId.toString());
  }

  socket.on("disconnect", () => {
    onlineUsers--;
    io.emit("onlineUsers", onlineUsers);
  });
});
