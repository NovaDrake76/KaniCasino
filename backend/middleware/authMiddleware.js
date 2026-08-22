const jwt = require("jsonwebtoken");
require("dotenv").config();
const User = require("../models/User");
const { WITHOUT_INVENTORY } = require("../utils/economy");


const isAuthenticated = async (req, res, next) => {
  // Extract the token from the Authorization header
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res.status(401).json({ message: "No authorization header provided" });
  }

  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
    return res.status(401).json({ message: "Invalid Authorization" });
  }

  const token = tokenParts[1];

  // Verify the token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // no route reads an inventory off req.user, and it reaches 21k entries: carrying it
    // here cost the deepest account 20 seconds on every authenticated request
    const user = await User.findById(decoded.userId).select({ password: 0, ...WITHOUT_INVENTORY });

    // a valid token for an account that no longer exists is not a session
    if (!user) {
      return res.status(401).json({ message: "Token is not valid" });
    }

    // a token from before the current version has been revoked. a missing version reads
    // as 0 so tokens issued before this existed keep working until the next revoke.
    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    // 403 rather than 401: a 401 tells the client the session died and it should log in
    // again, which would just loop. this is the account, not the session.
    if (user.disabled) {
      return res.status(403).json({ message: "This account has been disabled." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log(error.message)
    res.status(401).json({ message: "Token is not valid" });
  }
};

// a page that reads fine logged out but reads better logged in: attach the user when there
// is a usable token and carry on either way, so a stale token degrades to a guest view
// rather than a 401 on a public page.
const maybeAuthenticated = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) return next();
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return next();

  try {
    const decoded = jwt.verify(parts[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (user && !user.disabled && (decoded.tokenVersion || 0) === (user.tokenVersion || 0)) {
      req.user = user;
    }
  } catch (error) {
    // a guest with a bad token is still a guest
  }
  next();
};

const isAdmin = (req, res, next) => {

  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ message: "Access denied" });
  }
};

module.exports = {
  isAuthenticated,
  maybeAuthenticated,
  isAdmin,
};
