const jwt = require("jsonwebtoken");
require("dotenv").config();
const User = require("../models/User");


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
    const user = await User.findById(decoded.userId).select("-password");

    // a valid token for an account that no longer exists is not a session
    if (!user) {
      return res.status(401).json({ message: "Token is not valid" });
    }

    // a token from before the current version has been revoked. a missing version reads
    // as 0 so tokens issued before this existed keep working until the next revoke.
    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log(error.message)
    res.status(401).json({ message: "Token is not valid" });
  }
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
  isAdmin,
};
