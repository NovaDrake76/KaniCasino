const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");

const User = require("../models/User");
const Item = require("../models/Item");
const Notification = require("../models/Notification");
const Transaction = require("../models/Transaction");
const authMiddleware = require("../middleware/authMiddleware");
const { loginLimiter, registerLimiter } = require("../middleware/rateLimit");
const { sellValue } = require("../utils/itemValue");
const { creditUser, recordTransaction, runAtomic, TX } = require("../utils/economy");
const { findReferrer, payReferralBonuses } = require("../utils/referrals");
const { sellUniqueIds } = require("../utils/inventorySell");
const getRandomPlaceholderImage = require("../utils/placeholderImages");
const { ObjectId } = require('mongodb');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { resolvePassword } = require("../utils/password");

// Register user
router.post(
  "/register",
  registerLimiter,
  [
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
    check("username", "Please enter a valid username").not().isEmpty(),
  ],
  async (req, res) => {
    // Handle validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }


    const { email, password, username, profilePicture, referralCode } = req.body;

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

      // an unknown referral code is ignored rather than blocking the signup
      const referrer = referralCode ? await findReferrer(referralCode) : null;

      // Create new user. accept the password as plain text; for backwards
      // compatibility, decrypt a legacy AES-wrapped value if detected.
      const originalPassword = resolvePassword(password);
      user = new User({ email, username, profilePicture, isAdmin: false });
      if (referrer) user.referredBy = referrer._id;

      // Hash password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(originalPassword, salt);

      //if profilePicture is not provided, use default image
      if (!profilePicture || profilePicture === "") {
        user.profilePicture = getRandomPlaceholderImage();
      }

      // Save user to the database
      await user.save();

      await recordTransaction({
        userId: user._id,
        type: TX.SIGNUP,
        direction: "credit",
        amount: user.walletBalance,
        balanceAfter: user.walletBalance,
        meta: { source: "register" },
      });

      if (referrer) await payReferralBonuses(user, referrer);

      // Generate and send JWT
      const payload = { userId: user.id, tokenVersion: user.tokenVersion || 0 };
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: "30d" },
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
  loginLimiter,
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
        return res.status(400).json({ message: "Email not found" });
      }

      // accounts created via Google sign-in have no password set
      if (!user.password) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Compare passwords (plain text, decrypting legacy AES-wrapped values)
      const originalPassword = resolvePassword(password);

      const isMatch = await bcrypt.compare(originalPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Generate and send JWT
      const payload = { userId: user.id, tokenVersion: user.tokenVersion || 0 };
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: "30d" },
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

// Google login
router.post('/googlelogin', async (req, res) => {
  const { token, referralCode } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const googlePayload = ticket.getPayload();

    // Check if user exists in your DB or create a new one
    let user = await User.findOne({ email: googlePayload.email });
    if (!user) {
      let username = googlePayload.name;
      let existingUser = await User.findOne({ username });
      while (existingUser) {
        // Handle username conflict
        username = googlePayload.name + Math.floor(Math.random() * 1000);
        existingUser = await User.findOne({ username });
      }
      // a referral only counts at account creation, never on a later login
      const referrer = referralCode ? await findReferrer(referralCode) : null;
      user = new User({
        email: googlePayload.email,
        username: username,
        profilePicture: googlePayload.picture,
      });
      if (referrer) user.referredBy = referrer._id;
      await user.save();

      await recordTransaction({
        userId: user._id,
        type: TX.SIGNUP,
        direction: "credit",
        amount: user.walletBalance,
        balanceAfter: user.walletBalance,
        meta: { source: "google" },
      });

      if (referrer) await payReferralBonuses(user, referrer);
    }
    // Generate and send JWT
    const payload = { userId: user.id, tokenVersion: user.tokenVersion || 0 };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error in Google Authentication' });
  }
});

// Get notifications
router.get("/notifications", authMiddleware.isAuthenticated, async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    const notifications = await Notification.find({ receiverId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res.json(notifications);

    // set all notifications as read
    await Notification.updateMany({ receiverId: req.user._id, read: false }, { read: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

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
      nextBonus,
      isAdmin
    } = req.user;

    // verify in Notification model if there are unread notifications for the user
    const unreadNotifications = await Notification.find({ receiverId: req.user._id, read: false });
    const hasUnreadNotifications = unreadNotifications.length > 0;

    // isAdmin is the caller's own flag; the public /:id profile keeps hiding it
    res.json({ id, username, profilePicture, xp, level, walletBalance, nextBonus, hasUnreadNotifications, isAdmin: !!isAdmin });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Fetch top players
router.get('/topPlayers', async (req, res) => {
  try {
    const topPlayers = await User.find({})
      .sort({ weeklyWinnings: -1 })
      .limit(10) // Top 10 players
      .select('username weeklyWinnings profilePicture level fixedItem');

    res.json(topPlayers);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch user ranking
router.get('/ranking', authMiddleware.isAuthenticated, async (req, res) => {
  try {
    const me = { _id: req.user._id, username: req.user.username, weeklyWinnings: req.user.weeklyWinnings || 0 };
    // rank and neighbors come from indexed range queries instead of loading every
    // user; ties break by _id so two equal players never share a position
    const aboveFilter = {
      $or: [
        { weeklyWinnings: { $gt: me.weeklyWinnings } },
        { weeklyWinnings: me.weeklyWinnings, _id: { $lt: me._id } },
      ],
    };
    const belowFilter = {
      $or: [
        { weeklyWinnings: { $lt: me.weeklyWinnings } },
        { weeklyWinnings: me.weeklyWinnings, _id: { $gt: me._id } },
      ],
    };

    const [rankAbove, aboveAll, belowAll] = await Promise.all([
      User.countDocuments(aboveFilter),
      User.find(aboveFilter).sort({ weeklyWinnings: 1, _id: -1 }).limit(6).select('username weeklyWinnings'),
      User.find(belowFilter).sort({ weeklyWinnings: -1, _id: 1 }).limit(6).select('username weeklyWinnings'),
    ]);

    // pad the 7-row window toward the other side when near the top or bottom
    let aboveTake = Math.min(aboveAll.length, 3);
    let belowTake = Math.min(belowAll.length, 3);
    belowTake = Math.min(belowAll.length, belowTake + (3 - aboveTake));
    aboveTake = Math.min(aboveAll.length, aboveTake + (3 - Math.min(belowAll.length, 3)));

    const users = [...aboveAll.slice(0, aboveTake).reverse(), me, ...belowAll.slice(0, belowTake)];

    res.json({ ranking: rankAbove + 1, users });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get the authenticated user's balance history (private; paginated, newest first)
router.get('/transactions', authMiddleware.isAuthenticated, async (req, res) => {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const limit = Math.min(Math.max(1, Math.floor(Number(req.query.limit)) || 20), 50);
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.direction === 'credit' || req.query.direction === 'debit') {
      filter.direction = req.query.direction;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      transactions,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});



// Update wallet balance
// router.put("/wallet", authMiddleware.isAuthenticated, async (req, res) => {
//   try {
//     const { amount } = req.body;

//     const user = await User.findById(req.user._id);

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Update wallet balance
//     user.walletBalance += amount;
//     await user.save();

//     res.json(user.walletBalance);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send("Server error");
//   }
// });

// Sell items back to the house for coins (base value x sell rate)
router.post("/inventory/sell", authMiddleware.isAuthenticated, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.uniqueIds)
      ? req.body.uniqueIds
      : req.body.uniqueId
        ? [req.body.uniqueId]
        : [];
    if (!ids.length) {
      return res.status(400).json({ message: "No items selected" });
    }

    const result = await sellUniqueIds(req.user._id, ids);
    if (!result) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!result.sold) {
      return res.status(404).json({ message: "Items not found in inventory" });
    }

    res.json({
      message: `Sold ${result.sold} item${result.sold > 1 ? "s" : ""} for K₽${result.value}`,
      sold: result.sold,
      value: result.value,
      walletBalance: result.walletBalance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Set fixed item
router.put("/fixedItem", authMiddleware.isAuthenticated, async (req, res) => {
  try {
    const { item } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if item is in user's inventory
    const inventoryItemIndex = user.inventory.find((inventoryItem) => {
      return inventoryItem._id.toString() === item.toString();
    });


    if (inventoryItemIndex === null || inventoryItemIndex === undefined) {
      return res.status(404).json({ message: "Item not found in inventory" });
    }


    // Update fixed item, keeping the same description
    user.fixedItem = {
      name: inventoryItemIndex.name,
      image: inventoryItemIndex.image,
      rarity: inventoryItemIndex.rarity,
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
    const currentTime = new Date();
    const currentBonus = req.user.bonusAmount;
    const nextBonus = new Date(currentTime.getTime() + 8 * 60000); // 8 min later
    const nextBonusAmount = Math.floor(200 * (1 + 0.1 * req.user.level));

    // claim and record together: the nextBonus condition lets only one concurrent
    // request through, and a failed row rolls the claim back so it can be retried
    const updated = await runAtomic(async (session) => {
      const u = await User.findOneAndUpdate(
        { _id: req.user._id, nextBonus: { $lte: currentTime } },
        {
          $inc: { walletBalance: currentBonus },
          $set: { nextBonus, bonusAmount: nextBonusAmount },
        },
        { new: true, session }
      );
      if (!u) return null;
      await recordTransaction(
        { userId: req.user._id, type: TX.BONUS, direction: "credit", amount: currentBonus, balanceAfter: u.walletBalance, meta: {} },
        session
      );
      return u;
    });

    if (!updated) {
      return res.status(400).json({ message: 'Bonus not yet available' });
    }

    res.json({ message: `Claimed K₽${currentBonus}!`, value: currentBonus, nextBonus: updated.nextBonus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});



// revoke every token issued for this account by bumping its version; the caller and
// every other device must log in again. the fix for a stolen or leaked token.
router.post('/logout-all', authMiddleware.isAuthenticated, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    res.json({ message: "Signed out of all devices." });
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


// Get user by id (public profile: only non-sensitive fields)
router.get("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(
      await User.findById(req.params.id)
        .select("username profilePicture xp level fixedItem nextBonus weeklyWinnings")
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});


// These routes need to be at the end of the file, otherwise they will override other routes

// Get user inventory
const ITEMS_PER_PAGE = 18;


router.get("/inventory/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, rarity, sortBy, caseId } = req.query;
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);

    if (!ObjectId.isValid(userId)) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let query = { _id: user._id };  // Default to filtering by user ID

    // guard optional filters so malformed input can't throw
    const caseFilter = caseId && ObjectId.isValid(caseId) ? new ObjectId(caseId) : null;
    const nameRegex = name
      ? new RegExp(String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    // Count Pipeline
    let countPipeline = [
      { $match: query },
      { $project: { inventory: 1 } },
      { $unwind: "$inventory" }
    ];

    if (caseFilter) {
      countPipeline.push({ $match: { "inventory.case": caseFilter } });
    }

    if (nameRegex) {
      countPipeline.push({ $match: { "inventory.name": nameRegex } });
    }
    if (rarity) {
      countPipeline.push({ $match: { "inventory.rarity": rarity } });
    }

    countPipeline.push({ $count: "totalItems" });

    const totalCount = await User.aggregate(countPipeline);
    const totalItems = totalCount.length ? totalCount[0].totalItems : 0;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    // Main Pipeline
    let pipeline = [
      { $match: query },
      { $project: { inventory: 1 } },
      { $unwind: "$inventory" }
    ];

    if (caseFilter) {
      pipeline.push({ $match: { "inventory.case": caseFilter } });
    }

    if (nameRegex) {
      pipeline.push({ $match: { "inventory.name": nameRegex } });
    }
    if (rarity) {
      pipeline.push({ $match: { "inventory.rarity": rarity } });
    }

    // only known sort keys: an arbitrary one would be interpolated into the sort
    // path and blow up the aggregation
    const SORTS = {
      older: { "inventory.createdAt": 1 },
      newer: { "inventory.createdAt": -1 },
      mostRare: { "inventory.rarity": -1 },
      mostCommon: { "inventory.rarity": 1 },
    };
    if (sortBy && SORTS[sortBy]) {
      pipeline.push({ $sort: SORTS[sortBy] });
    }
    pipeline.push(
      { $group: { _id: null, inventory: { $push: "$inventory" } } },
      { $project: { inventory: { $slice: ["$inventory", (page - 1) * ITEMS_PER_PAGE, ITEMS_PER_PAGE] } } }
    );

    const inventoryItems = await User.aggregate(pipeline);
    const items = inventoryItems[0]?.inventory || [];

    // attach authoritative base/sell value from the item catalog
    const ids = [...new Set(items.map((i) => String(i._id)))];
    const catalog = await Item.find({ _id: { $in: ids } }, { baseValue: 1 });
    const baseById = new Map(catalog.map((i) => [String(i._id), i.baseValue || 0]));
    const withValue = items.map((i) => {
      const base = baseById.get(String(i._id)) || 0;
      return { ...i, baseValue: base, sellValue: sellValue(base) };
    });

    res.json({
      items: withValue,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = router;
