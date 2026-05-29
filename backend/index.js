const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const socketIO = require("socket.io");
const cronJobs = require("./tasks/cronJobs");
const checkApiKey = require("./middleware/checkApiKey");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

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
const itemBattle = require("./games/itemBattle");
const userRoutes = require("./routes/userRoutes");
const caseRoutes = require("./routes/caseRoutes");
const itemRoutes = require("./routes/itemRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes")(io);
const adminRoutes = require("./routes/adminRoutes");
const gamesRoutes = require("./routes/gamesRoutes")(io);
const friendsRoutes = require("./routes/friendsRoutes")(io);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // useCreateIndex: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Middleware
app.use(express.json());
app.use(cors(corsOptions));

// block requests from outside
app.use(checkApiKey);

// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 800, // limit each IP to 800 requests per window
// });

// app.use(limiter);

// Routes
// app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/cases", caseRoutes);
app.use("/items", itemRoutes);
app.use("/marketplace", marketplaceRoutes);
app.use("/admin", adminRoutes);
app.use("/games", gamesRoutes);
app.use("/friends", friendsRoutes);

// Start the games
coinFlip(io);
crash(io);
itemBattle(io);

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
