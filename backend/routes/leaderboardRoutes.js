const express = require("express");
const router = express.Router();
const { maybeAuthenticated } = require("../middleware/authMiddleware");

const Leaderboard = require("../models/Leaderboard");
const badges = require("../utils/badges");
const leaderboard = require("../utils/leaderboard");
const verification = require("../utils/verification");
const { TABLE, MULTIPLIERS } = require("../utils/leaderboardPoints");

const publicRow = (row, index) => ({
  _id: row._id,
  rank: index + 1,
  points: row.points,
  bets: row.bets,
  prize: row.placeholder ? 0 : leaderboard.prizeFor(index + 1),
  placeholder: !!row.placeholder,
  username: row.user.username,
  slug: row.user.slug,
  profilePicture: row.user.profilePicture,
  level: row.user.level,
  fixedItem: row.user.fixedItem,
  badge: badges.wornBadge(row.user),
});

// the whole board: who is winning, what each place pays, when it closes, and where the
// caller sits. one endpoint because the page renders in one go.
router.get("/", maybeAuthenticated, async (req, res) => {
  try {
    // the board is one recount answering every viewer, shared rather than run per request (utils/leaderboard.js)
    const current = await leaderboard.today();
    const { rows } = await leaderboard.live(current.startsAt, current.endsAt);

    const payload = {
      boardId: String(current._id),
      startsAt: current.startsAt,
      endsAt: current.endsAt,
      serverTime: new Date(),
      paidPlaces: leaderboard.PAID_PLACES,
      pool: leaderboard.totalPool,
      prizes: leaderboard.PRIZES,
      standings: rows.map(publicRow),
      me: null,
    };

    if (req.user) {
      // from the lock date an unverified account plays and scores but is not ranked or paid
      const needsVerify = verification.enforced(current.startsAt) && !verification.isVerified(req.user);
      const scoredMine = await leaderboard.standingFor(req.user._id, current.startsAt, current.endsAt);
      const mine = needsVerify ? { ...scoredMine, rank: null } : scoredMine;
      // against the last row somebody actually earned, not a padded seat on nought
      const earned = rows.filter((row) => !row.placeholder);
      const lastPaid =
        earned.length >= leaderboard.PAID_PLACES ? earned[earned.length - 1].points : 0;
      payload.me = {
        // the id lets the board mark the caller's own row rather than repeat it underneath
        _id: String(req.user._id),
        ...mine,
        // what it would take to reach the last paid place, which is the only number a
        // player outside the top ten actually wants
        toPaidPlace:
          mine.rank && mine.rank <= leaderboard.PAID_PLACES ? 0 : Math.max(0, lastPaid - mine.points + 1),
        prize: mine.rank && mine.rank <= leaderboard.PAID_PLACES ? leaderboard.prizeFor(mine.rank) : 0,
        needsVerify,
      };
    }

    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// how points are scored, for the panel that explains it. served rather than hardcoded in
// the client so the table and the scoring can never disagree.
router.get("/points", (req, res) => {
  res.json({
    games: TABLE.map((g) => ({ key: g.key, type: g.type, edge: g.edge, multiplier: MULTIPLIERS[g.type] })),
  });
});

// the last few finished boards, so a board that just reset still shows who won it
router.get("/history", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 7, 30);
    const boards = await Leaderboard.find({ status: "settled", settlementDone: true })
      .sort({ startsAt: -1 })
      .limit(limit)
      .select("startsAt endsAt standings")
      .lean();

    res.json(
      boards.map((r) => ({
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        standings: (r.standings || []).slice(0, 3).map((s) => ({
          userId: s.userId,
          username: s.username,
          rank: s.rank,
          points: s.points,
          prize: s.prize,
        })),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
