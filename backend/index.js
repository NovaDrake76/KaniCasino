const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const socketIO = require("socket.io");
const cronJobs = require("./tasks/cronJobs");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: 'https://kanicasino.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true,
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  const allowedOrigins = ['https://kanicasino.com'];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  next();
});

const io = socketIO(server, {
  cors: {
    origin: 'https://kanicasino.com',
    methods: ['GET', 'POST'],
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
