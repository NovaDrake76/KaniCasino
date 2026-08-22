const jwt = require("jsonwebtoken");
const User = require("../models/User");

// the socket half of isAuthenticated, and it has to make every check the http side makes.
// a connection that skips one is a session the site has no way to take back: socket
// identity is claimed once at the handshake and then trusted for the life of the socket.
async function identify(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const account = await User.findById(decoded.userId).select("disabled tokenVersion").lean();
    // a token for an account that no longer exists is not a session
    if (!account || account.disabled) return null;
    // revoked by a logout-everywhere or a ban: the http side refuses it, so must this
    if ((decoded.tokenVersion || 0) !== (account.tokenVersion || 0)) return null;
    return String(decoded.userId);
  } catch (err) {
    return null; // invalid or expired: a guest connection, not an error
  }
}

// an unusable token connects as a guest rather than being refused: crash and coin flip
// are watchable logged out, and only the bet handlers require socket.userId.
async function socketAuth(socket, next) {
  const handshake = socket.handshake || {};
  const token = handshake.auth && handshake.auth.token;
  const userId = await identify(token);
  if (userId) socket.userId = userId;
  next();
}

module.exports = { socketAuth, identify };
