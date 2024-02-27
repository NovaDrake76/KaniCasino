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
    req.user = await User.findById(decoded.userId).select("-password");
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
