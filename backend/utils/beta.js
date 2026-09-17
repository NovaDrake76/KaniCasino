// features a few accounts see first. a flag lives on the user until the feature opens to
// everyone, which is one env switch rather than a data migration.
const FLAGS = ["daisu"];

const openToAll = (flag) => process.env[`BETA_OPEN_${flag.toUpperCase()}`] === "1";

const has = (user, flag) => openToAll(flag) || ((user && user.betaFlags) || []).includes(flag);

const featuresOf = (user) => Object.fromEntries(FLAGS.map((flag) => [flag, has(user, flag)]));

const requireFlag = (flag) => (req, res, next) =>
  has(req.user, flag) ? next() : res.status(403).json({ message: "Not part of this beta", reason: "beta" });

module.exports = { FLAGS, has, featuresOf, requireFlag };
