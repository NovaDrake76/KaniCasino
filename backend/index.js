const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const socketIO = require("socket.io");
const cronJobs = require("./tasks/cronJobs");
const checkApiKey = require("./middleware/checkApiKey");
const rateLimit = require("express-rate-limit");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

const isDevelopment = process.env.NODE_ENV === "development";

const corsOptions = {
  origin: function (origin, callback) {
    if (isDevelopment) {
      callback(null, true);
    } else {
      if (origin === "https://kanicasino.com") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true,
};

app.use((req, res, next) => {
  const allowedOrigins = isDevelopment ? ["*"] : ["https://kanicasino.com"];
  const origin = req.headers.origin;

  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
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
    origin: function (origin, callback) {
      if (isDevelopment) {
        callback(null, true);
      } else {
        if (origin === "https://kanicasino.com") {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  },
});

const coinFlip = require("./games/coinFlip");
const crash = require("./games/crash");
const userRoutes = require("./routes/userRoutes");
const caseRoutes = require("./routes/caseRoutes");
const itemRoutes = require("./routes/itemRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes")(io);
const adminRoutes = require("./routes/adminRoutes");
const gamesRoutes = require("./routes/gamesRoutes")(io);

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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 800, // limit each IP to 800 requests per window
});

app.use(limiter);

// Routes
// app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/cases", caseRoutes);
app.use("/items", itemRoutes);
app.use("/marketplace", marketplaceRoutes);
app.use("/admin", adminRoutes);
app.use("/games", gamesRoutes);

// Start the games
coinFlip(io);
crash(io);

// Start the cron jobs
cronJobs.startCronJobs(io);

const port = process.env.PORT || 5000;

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

let onlineUsers = 0;

io.on("connection", (socket) => {
  onlineUsers++;
  io.emit("onlineUsers", onlineUsers);

  socket.on("joinRoom", (userId) => {
    socket.join(userId);
  });

  socket.on("disconnect", () => {
    onlineUsers--;
    io.emit("onlineUsers", onlineUsers);
  });
});
