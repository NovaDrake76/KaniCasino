const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");

const User = require("../models/User");
const FanBoard = require("../models/FanBoard");
const CollectorBoard = require("../models/CollectorBoard");
const fandom = require("../utils/fandom");

const PAGE_SIZE = 24;
const REACH_KEPT = 12;

const publicFan = (fan) =>
  fan && {
    userId: fan.userId,
    username: fan.username,
    profilePicture: fan.profilePicture,
    level: fan.level,
    count: fan.count,
    since: fan.since,
  };

const publicBoard = (board) => ({
  name: board.name,
  image: board.image,
  rarity: board.rarity,
  caseId: board.caseId || null,
  fanCount: board.fanCount,
  topCount: board.topCount || 0,
  secondCount: board.secondCount || 0,
  gap: typeof board.gap === "number" ? board.gap : 999999,
  top: board.topCount > 0 ? publicFan(board.top) : null,
});

// browse. "open" is the one that gets a newcomer moving: characters nobody holds yet.
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const search = String(req.query.q || "").trim();
    const sort = String(req.query.sort || "contested");

    const filter = {};
    if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (sort === "open") filter.topCount = { $lte: 0 };

    const order =
      sort === "biggest"
        ? { topCount: -1, fanCount: -1, name: 1 }
        : sort === "open"
        ? { name: 1 }
        // closest race first, and a board with nobody chasing sorts behind every real one
        : { gap: 1, fanCount: -1, name: 1 };

    const [boards, total] = await Promise.all([
      FanBoard.find(filter).sort(order).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      FanBoard.countDocuments(filter),
    ]);

    res.json({
      boards: boards.map(publicBoard),
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    console.error("fandom browse:", err.message);
    res.status(500).json({ message: "Could not load the boards" });
  }
});

// the other board: not one character held deep, but how much of the roster you have seen
router.get("/collectors", async (req, res) => {
  try {
    const board = await CollectorBoard.findOne({ key: "collection" }).lean();
    if (!board) return res.json({ characterCount: 0, ranks: [], updatedAt: null });
    res.json({
      characterCount: board.characterCount,
      updatedAt: board.updatedAt,
      ranks: (board.ranks || []).map((row) => ({
        userId: row.userId,
        username: row.username,
        profilePicture: row.profilePicture,
        level: row.level,
        distinct: row.distinct,
        total: row.total,
      })),
    });
  } catch (err) {
    console.error("fandom collectors:", err.message);
    res.status(500).json({ message: "Could not load the collection board" });
  }
});

// must stay above /:name, or a character called "reach" would swallow it
router.get("/reach", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("inventory fixedItem").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const nameById = await fandom.namesByItemId();
    const held = new Map();
    for (const entry of user.inventory || []) {
      if (!entry) continue;
      const name = nameById.get(String(entry._id)) || entry.name;
      if (!name) continue;
      held.set(name, (held.get(name) || 0) + 1);
    }
    if (!held.size) return res.json({ reach: [] });

    const boards = await FanBoard.find({ name: { $in: [...held.keys()] } })
      .select("name image rarity caseId fanCount topCount secondCount gap top")
      .lean();

    const pinnedName = user.fixedItem && user.fixedItem.name;
    const reach = boards.map((board) => {
      const mine = held.get(board.name) || 0;
      const leader = board.topCount || 0;
      const leaderIsMe = board.top && String(board.top.userId) === String(req.user._id);
      // holding the lead on a board you have not pinned still costs you a pin to claim
      const behind = leaderIsMe ? 0 : Math.max(0, leader - mine + 1);
      return {
        name: board.name,
        image: board.image,
        rarity: board.rarity,
        caseId: board.caseId || null,
        mine,
        leader,
        leaderName: leader > 0 && board.top ? board.top.username : null,
        behind,
        fanCount: board.fanCount,
        pinned: pinnedName === board.name,
        holding: leaderIsMe,
      };
    });

    // the ones you already hold sit at the bottom: this list is about what is still to take
    reach.sort((a, b) => Number(a.holding) - Number(b.holding) || a.behind - b.behind || b.mine - a.mine);
    res.json({ reach: reach.slice(0, REACH_KEPT) });
  } catch (err) {
    console.error("fandom reach:", err.message);
    res.status(500).json({ message: "Could not work out your standings" });
  }
});

// the viewer's own standing on one board, so the page can say what it would take
router.get("/:name/me", isAuthenticated, async (req, res) => {
  try {
    const name = req.params.name;
    const user = await User.findById(req.user._id).select("inventory fixedItem").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const character = (await fandom.charactersByName([name])).get(name);
    let mine = 0;
    let itemId = null;
    for (const entry of user.inventory || []) {
      if (!fandom.isCopyOf(entry, character)) continue;
      mine += 1;
      if (!itemId) itemId = entry._id;
    }

    const board = await FanBoard.findOne({ name }).select("topCount top").lean();
    const leader = board ? board.topCount || 0 : 0;
    const holding = !!(board && board.top && String(board.top.userId) === String(req.user._id));
    res.json({
      mine,
      itemId,
      holding,
      pinned: (user.fixedItem && user.fixedItem.name) === name,
      pinnedName: (user.fixedItem && user.fixedItem.name) || null,
      behind: holding ? 0 : Math.max(0, leader - mine + 1),
    });
  } catch (err) {
    console.error("fandom standing:", err.message);
    res.status(500).json({ message: "Could not work out your standing" });
  }
});

router.get("/:name", async (req, res) => {
  try {
    const board = await FanBoard.findOne({ name: req.params.name }).lean();
    if (!board) return res.status(404).json({ message: "No such character" });
    res.json({
      ...publicBoard(board),
      ranks: (board.ranks || []).map(publicFan),
      updatedAt: board.updatedAt,
    });
  } catch (err) {
    console.error("fandom board:", err.message);
    res.status(500).json({ message: "Could not load the board" });
  }
});

module.exports = router;
