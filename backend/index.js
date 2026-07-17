const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const socketIO = require("socket.io");
const cronJobs = require("./tasks/cronJobs");
const checkApiKey = require("./middleware/checkApiKey");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

// deploy webhook is mounted first, with a raw body parser, so it bypasses the
// CORS + api-key gates below (GitHub sends neither) and can verify its own HMAC
const { githubDeployHandler } = require("./deployWebhook");
app.post("/deploy/github", express.raw({ type: "*/*" }), githubDeployHandler);

// public liveness probe (also bypasses the api-key gate so monitors can hit it)
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

const isDevelopment = process.env.NODE_ENV === "development";

// allowed origins are configurable via ALLOWED_ORIGINS (comma-separated); falls
// back to the production domain so behaviour is unchanged when it isn't set
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://kanicasino.com")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => isDevelopment || allowedOrigins.includes(origin);

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
};

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isDevelopment || allowedOrigins.includes(origin)) {
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

const coinFlip = require("./games/coinFlip");
const crash = require("./games/crash");
const caseBattle = require("./games/caseBattle");
const { recoverStuckRounds } = require("./utils/rounds");
const { completeStuckBattles } = require("./games/battleEngine");
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

// settle whatever the last shutdown interrupted before dealing anyone in again: a live
// crash or coin flip round holds real stakes, and until this runs they are unaccounted.
// it repeats because a give-back loop that dies holds its lease until that goes stale,
// and a boot-only sweep would leave the money it still owes until the next restart.
const sweepRounds = () => {
  recoverStuckRounds(io, coinFlip.winPayout).catch((e) => console.log(e));
  completeStuckBattles(io).catch((e) => console.log(e));
};
sweepRounds();
setInterval(sweepRounds, 5 * 60 * 1000);

// Start the games
coinFlip(io);
crash(io);
caseBattle(io);

// Start the cron jobs
cronJobs.startCronJobs(io);

const port = process.env.PORT || 5000;

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

let onlineUsers = 0;

// optional auth: a valid token binds socket.userId; anonymous sockets may still
// watch games but the game handlers ignore any client-supplied identity.
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
    }
  } catch (err) {
    // invalid/expired token: continue unauthenticated
  }
  next();
});

io.on("connection", (socket) => {
  onlineUsers++;
  io.emit("onlineUsers", onlineUsers);

  // join the authenticated user's private room for targeted updates
  if (socket.userId) {
    socket.join(socket.userId.toString());
  }

  socket.on("disconnect", () => {
    onlineUsers--;
    io.emit("onlineUsers", onlineUsers);
  });
});
