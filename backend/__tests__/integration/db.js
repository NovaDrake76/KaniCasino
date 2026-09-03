const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const itemCatalog = require("../../utils/itemCatalog");

let mongod;

async function setupDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // a duplicate only fails because of a unique index, and mongoose builds those in the
  // background, so without this a fast test can run before its index exists
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}

async function clearDb() {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
  // these wipes go through the raw driver, so no model hook fires to clear the catalog
  itemCatalog.invalidate();
}

async function teardownDb() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

module.exports = { setupDb, clearDb, teardownDb };
