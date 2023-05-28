const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");

const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const getRandomPlaceholderImage = require("../utils/placeholderImages");

// Register user
router.post(
  "/register",
  [
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
    check("username", "Please enter a valid username").not().isEmpty(),
    check("isAdmin", "isAdmin must be a boolean value").optional().isBoolean(),
  ],
  async (req, res) => {
    // Handle validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, username, profilePicture, isAdmin } = req.body;

    try {
      // Check if user already exists
      let userMail = await User.findOne({ email });
      if (userMail) {
        return res.status(400).json({ message: "Email already registered" });
      }
      let userName = await User.findOne({ username });
      if (userName) {
        return res.status(400).json({ message: "Username already registered" });
      }

      if (!isValidBase64(profilePicture) && profilePicture !== "") return res.status(400).json({ message: "Invalid profile picture" })

      // Create new user
      user = new User({ email, password, username, profilePicture, isAdmin });

      // Hash password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);

      //if profilePicture is not provided, use default image
      if (!profilePicture || profilePicture === "") {
        user.profilePicture = getRandomPlaceholderImage();
      }

      // Save user to the database
      await user.save();

      // Generate and send JWT
      const payload = { userId: user.id };
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
        (err, token) => {
          if (err) throw err;
          res.json({ token });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// Login user
router.post(
  "/login",

  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  async (req, res) => {
    // Handle validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Compare passwords
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Generate and send JWT
      const payload = { userId: user.id };
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
        (err, token) => {
          if (err) throw err;
          res.json({ token });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// Get logged-in user data
router.get("/me", authMiddleware.isAuthenticated, async (req, res) => {
  try {
    const {
      _id: id,
      username,
      profilePicture,
      xp,
      level,
      walletBalance,
      nextBonus
    } = req.user;
    res.json({ id, username, profilePicture, xp, level, walletBalance, nextBonus });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Get user by id
router.get("/:id", async (req, res) => {
  try {
    res.json(
      await User.findById(req.params.id)
        .select("-inventory")
        .select("-password")
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Update wallet balance
router.put("/wallet", authMiddleware.isAuthenticated, async (req, res) => {
  try {
    const { amount } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update wallet balance
    user.walletBalance += amount;
    await user.save();

    res.json(user.walletBalance);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Add item to user inventory
router.post("/inventory", authMiddleware.isAuthenticated, async (req, res) => {
  try {
    const { itemId } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add item to inventory
    user.inventory.push(itemId);
    await user.save();

    res.json(user.inventory);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Remove item from user inventory
router.delete(
  "/inventory/:itemId",
  authMiddleware.isAuthenticated,
  async (req, res) => {
    try {
      const { itemId } = req.params;

      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove item from inventory
      user.inventory = user.inventory.filter(
        (item) => item.toString() !== itemId
      );
      await user.save();

      res.json(user.inventory);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// Get user inventory
const ITEMS_PER_PAGE = 20;

router.get("/inventory/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const totalItems = user.inventory.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const inventoryItems = user.inventory.slice(
      (page - 1) * ITEMS_PER_PAGE,
      page * ITEMS_PER_PAGE
    );

    res.json({
      items: inventoryItems,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Set fixed item
router.put("/fixedItem", authMiddleware.isAuthenticated, async (req, res) => {
  try {
    const { name, image, rarity } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update fixed item, keeping the same description
    user.fixedItem = {
      name,
      image,
      rarity,
      description: user.fixedItem.description,
    };
    await user.save();

    res.json(user.fixedItem);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// update fixed item description
router.put(
  "/fixedItem/description",
  authMiddleware.isAuthenticated,
  async (req, res) => {
    try {
      const { description } = req.body;

      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update fixed item description (crop to 50 characters)
      user.fixedItem.description = description.substring(0, 50);

      await user.save();

      res.json(user.fixedItem);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

router.post('/claimBonus', authMiddleware.isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentTime = new Date();
    const nextBonusTime = new Date(user.nextBonus);

    // Check if bonus is available
    if (currentTime >= nextBonusTime) {
      let currentBonus = user.bonusAmount; // Get current bonus amount
      user.walletBalance += user.bonusAmount; // Add bonus to wallet
      user.nextBonus = new Date(currentTime.getTime() + 60 * 60 * 1000); // Set next bonus time to 1 hour later
      user.bonusAmount = 50; // Set bonus amount to 50 for next time

      // Save updated user
      await user.save();

      res.json({ message: `Claimed C₽${currentBonus}!`, value: currentBonus, nextBonus: user.nextBonus });

    } else {
      res.status(400).json({ message: 'Bonus not yet available' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});



const isValidBase64 = (str) => {
  const base64Regex = /^data:image\/(png|jpeg|jpg);base64,/;
  return base64Regex.test(str);
};


router.put('/profilePicture', authMiddleware.isAuthenticated, async (req, res) => {
  try {
    const newProfilePicture = req.body.image;

    if (!isValidBase64(newProfilePicture)) {
      return res.status(400).json({ message: 'Invalid image format' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.profilePicture = newProfilePicture;

    await user.save();

    res.json({ message: 'Profile picture updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
