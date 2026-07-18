const Seed = require("../models/Seed");
const { generateServerSeed, hashServerSeed, generateClientSeed } = require("./provablyFair");

// after this many rolls a seed auto-rotates (revealing it), so seeds don't live forever
const AUTO_ROTATE_NONCE = 1000;

// the active seed for a user, creating one on first use. safe under concurrent
// first-rolls thanks to the partial-unique index on active seeds.
async function getOrCreateActiveSeed(userId) {
  const existing = await Seed.findOne({ userId, active: true });
  if (existing) return existing;

  const serverSeed = generateServerSeed();
  try {
    return await Seed.create({
      userId,
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed: generateClientSeed(),
    });
  } catch (e) {
    if (e.code === 11000) return Seed.findOne({ userId, active: true }); // lost the race
    throw e;
  }
}

// atomically reserve `count` consecutive nonces before any outcome is computed.
// returns the secret material + the first reserved nonce. the nonce is never
// rolled back (a failed charge must not let a user re-roll the same nonce).
async function reserveNonces(userId, count = 1) {
  const seed = await getOrCreateActiveSeed(userId);
  const before = await Seed.findOneAndUpdate(
    { _id: seed._id, active: true },
    { $inc: { nonce: count } },
    { new: false }
  );
  if (!before) {
    // a benign race with a concurrent rotate; callers can surface it as a retryable 409
    const err = new Error("Seed rotated mid-roll, please retry");
    err.status = 409;
    throw err;
  }

  const material = {
    seedId: seed._id,
    serverSeed: seed.serverSeed,
    serverSeedHash: seed.serverSeedHash,
    clientSeed: seed.clientSeed,
    startNonce: before.nonce,
  };

  // auto-rotate exactly when this reservation crosses the threshold: the current
  // rolls used the (now old) seed, and it is revealed so they become verifiable at
  // once; future rolls use the fresh seed. the client seed carries over.
  if (before.nonce < AUTO_ROTATE_NONCE && before.nonce + count >= AUTO_ROTATE_NONCE) {
    await rotate(userId);
  }

  return material;
}

// public view of the active seed; never exposes serverSeed.
async function getPublicSeedState(userId) {
  const seed = await getOrCreateActiveSeed(userId);
  return {
    clientSeed: seed.clientSeed,
    serverSeedHash: seed.serverSeedHash,
    nonce: seed.nonce,
  };
}

async function setClientSeed(userId, clientSeed) {
  await getOrCreateActiveSeed(userId);
  return Seed.findOneAndUpdate(
    { userId, active: true },
    { $set: { clientSeed } },
    { new: true }
  );
}

// reveal the current serverSeed and commit a fresh one (nonce resets to 0). the
// new clientSeed defaults to the old one unless the caller supplies a new value.
async function rotate(userId, newClientSeed) {
  const old = await Seed.findOneAndUpdate(
    { userId, active: true },
    { $set: { active: false, revealedAt: new Date() } },
    { new: true }
  );
  if (!old) {
    const current = await getOrCreateActiveSeed(userId);
    return { revealed: null, current };
  }

  const serverSeed = generateServerSeed();
  try {
    const current = await Seed.create({
      userId,
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed: newClientSeed || old.clientSeed,
    });
    return { revealed: old, current };
  } catch (e) {
    if (e.code === 11000) {
      // a concurrent roll already created the next active seed
      const current = await Seed.findOne({ userId, active: true });
      return { revealed: old, current };
    }
    throw e;
  }
}

// revealed (rotated) seeds a user can fully verify; serverSeed is exposable now.
async function getRevealedSeeds(userId) {
  return Seed.find({ userId, active: false })
    .select("serverSeed serverSeedHash clientSeed nonce revealedAt createdAt")
    .sort({ revealedAt: -1 })
    .limit(50);
}

module.exports = {
  AUTO_ROTATE_NONCE,
  getOrCreateActiveSeed,
  reserveNonces,
  getPublicSeedState,
  setClientSeed,
  rotate,
  getRevealedSeeds,
};
