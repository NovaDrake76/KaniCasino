const express = require("express");
const jwt = require("jsonwebtoken");

const userRoutes = require("../../routes/userRoutes");
const marketplaceRoutes = require("../../routes/marketplaceRoutes");
const friendsRoutes = require("../../routes/friendsRoutes");
const gamesRoutes = require("../../routes/gamesRoutes");
const fairRoutes = require("../../routes/fairRoutes");
const collectionsRoutes = require("../../routes/collectionsRoutes");
const missionsRoutes = require("../../routes/missionsRoutes");
const adminRoutes = require("../../routes/adminRoutes");

// no-op socket.io stand-in
const io = { emit: () => {}, to: () => ({ emit: () => {} }) };

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  app.use("/users", userRoutes);
  app.use("/marketplace", marketplaceRoutes(io));
  app.use("/friends", friendsRoutes(io));
  app.use("/games", gamesRoutes(io));
  app.use("/fair", fairRoutes);
  app.use("/collections", collectionsRoutes);
  app.use("/missions", missionsRoutes(io));
  app.use("/admin", adminRoutes);
  return app;
}

function tokenFor(user) {
  return jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${counter}-${process.hrtime.bigint()}`;
}

module.exports = { makeApp, tokenFor, io, uniqueSuffix };
