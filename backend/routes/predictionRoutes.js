const express = require("express");
const { isAuthenticated, maybeAuthenticated } = require("../middleware/authMiddleware");
const Prediction = require("../models/Prediction");
const PredictionPosition = require("../models/PredictionPosition");
const PredictionTrade = require("../models/PredictionTrade");
const PredictionPricepoint = require("../models/PredictionPricepoint");
const User = require("../models/User");
const { trade, quote, publicView } = require("../utils/predictions");

const PAGE_SIZE = 24;
const FEED_SIZE = 30;

// a market has one url, and it is the slug. everything hangs off it.
const findBySlug = (slug) => Prediction.findOne({ slug });

// a user's open shares in the markets on this page, so the cards can say what they hold
async function positionsFor(userId, predictionIds) {
  if (!userId) return new Map();
  const rows = await PredictionPosition.find({
    userId,
    predictionId: { $in: predictionIds },
    shares: { $gt: 0 },
  }).lean();
  const byMarket = new Map();
  for (const row of rows) {
    const list = byMarket.get(String(row.predictionId)) || [];
    list.push(row);
    byMarket.set(String(row.predictionId), list);
  }
  return byMarket;
}

module.exports = (io) => {
  const router = express.Router();

  // the board. open markets first, because a resolved one is a record and not a game.
  router.get("/", maybeAuthenticated, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.category && req.query.category !== "All") filter.category = req.query.category;
      if (req.query.q) filter.title = { $regex: String(req.query.q).slice(0, 60), $options: "i" };

      const [rows, total, categories] = await Promise.all([
        Prediction.find(filter)
          .sort({ status: 1, volume: -1, createdAt: -1 })
          .skip((page - 1) * PAGE_SIZE)
          .limit(PAGE_SIZE)
          .lean(),
        Prediction.countDocuments(filter),
        Prediction.distinct("category"),
      ]);

      const held = await positionsFor(req.user && req.user._id, rows.map((r) => r._id));
      res.json({
        predictions: rows.map((r) => publicView(r, held.get(String(r._id)) || [])),
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        currentPage: page,
        categories: categories.sort(),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // must stay above the /:slug catch-all, or a player named their market "me"
  router.get("/me/positions", isAuthenticated, async (req, res) => {
    try {
      const rows = await PredictionPosition.find({ userId: req.user._id })
        .sort({ updatedAt: -1 })
        .limit(200)
        .populate("predictionId", "slug title image status resolvedOutcome outcomes endsAt")
        .lean();

      const positions = rows
        .filter((r) => r.predictionId)
        .map((r) => {
          const market = r.predictionId;
          const outcome = market.outcomes.find((o) => o.key === r.outcomeKey);
          return {
            _id: r._id,
            shares: r.shares,
            spent: r.spent,
            avgPriceBps: r.shares > 0 ? Math.round(r.costBps / r.shares) : 0,
            settled: r.settled,
            payout: r.payout,
            outcomeKey: r.outcomeKey,
            outcomeLabel: outcome ? outcome.label : r.outcomeKey,
            priceBps: outcome ? outcome.priceBps : 0,
            // what selling right now would be worth, before the price impact of the sale
            value: outcome ? Math.floor((r.shares * outcome.priceBps) / 10000) : 0,
            market: {
              slug: market.slug,
              title: market.title,
              image: market.image,
              status: market.status,
              endsAt: market.endsAt,
              resolvedOutcome: market.resolvedOutcome,
            },
          };
        });
      res.json({ positions });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  router.get("/:slug", maybeAuthenticated, async (req, res) => {
    try {
      const prediction = await findBySlug(req.params.slug);
      if (!prediction) return res.status(404).json({ message: "That market does not exist" });

      const held = req.user
        ? await PredictionPosition.find({ userId: req.user._id, predictionId: prediction._id }).lean()
        : [];
      res.json(publicView(prediction, held));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // the chart. one series per outcome, thinned to a readable number of points.
  router.get("/:slug/history", async (req, res) => {
    try {
      const prediction = await findBySlug(req.params.slug);
      if (!prediction) return res.status(404).json({ message: "That market does not exist" });

      const points = await PredictionPricepoint.find({ predictionId: prediction._id })
        .sort({ at: 1 })
        .limit(4000)
        .lean();

      const series = prediction.outcomes.map((o) => ({
        key: o.key,
        label: o.label,
        // a market opens before anybody trades it, so the line starts at the opening price
        points: [{ at: prediction.createdAt, priceBps: 0 }],
      }));
      const byKey = new Map(series.map((s) => [s.key, s]));
      for (const point of points) {
        const line = byKey.get(point.outcomeKey);
        if (line) line.points.push({ at: point.at, priceBps: point.priceBps });
      }
      // the placeholder first point cannot know the opening price until the rest is read
      series.forEach((line, i) => {
        line.points[0].priceBps = line.points.length > 1 ? line.points[1].priceBps : prediction.outcomes[i].priceBps;
      });
      res.json({ series });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // who is betting on what, which is half of why anybody watches a market
  router.get("/:slug/trades", async (req, res) => {
    try {
      const prediction = await findBySlug(req.params.slug);
      if (!prediction) return res.status(404).json({ message: "That market does not exist" });

      const rows = await PredictionTrade.find({ predictionId: prediction._id })
        .sort({ createdAt: -1 })
        .limit(FEED_SIZE)
        .populate({ path: "userId", select: "username profilePicture level disabled", match: { disabled: { $ne: true } } })
        .lean();

      const labels = new Map(prediction.outcomes.map((o) => [o.key, o.label]));
      res.json({
        trades: rows
          .filter((r) => r.userId)
          .map((r) => ({
            _id: r._id,
            user: { _id: r.userId._id, username: r.userId.username, profilePicture: r.userId.profilePicture, level: r.userId.level },
            action: r.action,
            shares: r.shares,
            amount: r.amount,
            avgPriceBps: r.avgPriceBps,
            outcomeKey: r.outcomeKey,
            outcomeLabel: labels.get(r.outcomeKey) || r.outcomeKey,
            createdAt: r.createdAt,
          })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // what a trade would cost, priced by the same call that fills it
  router.post("/:slug/quote", isAuthenticated, async (req, res) => {
    try {
      const prediction = await findBySlug(req.params.slug);
      if (!prediction) return res.status(404).json({ message: "That market does not exist" });

      const shares = Number(req.body.shares);
      const q = quote(prediction, req.body.outcome, req.body.action, shares);
      if (q.error) return res.status(400).json({ message: q.error });

      const held = await PredictionPosition.findOne({
        userId: req.user._id,
        predictionId: prediction._id,
        outcomeKey: req.body.outcome,
      });
      res.json({
        shares: q.shares,
        amount: q.amount,
        avgPriceBps: q.avgBps,
        startBps: q.startBps,
        endBps: q.endBps,
        prices: q.prices,
        held: held ? held.shares : 0,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  router.post("/:slug/trade", isAuthenticated, async (req, res) => {
    try {
      const prediction = await findBySlug(req.params.slug);
      if (!prediction) return res.status(404).json({ message: "That market does not exist" });

      const result = await trade({
        userId: req.user._id,
        predictionId: prediction._id,
        outcomeKey: req.body.outcome,
        action: req.body.action,
        shares: Number(req.body.shares),
      });
      if (result.error) return res.status(400).json({ message: result.error });

      const held = await PredictionPosition.find({ userId: req.user._id, predictionId: prediction._id }).lean();
      const user = await User.findById(req.user._id).select("walletBalance").lean();
      const view = publicView(result.prediction, held);

      // everyone watching this market sees the price move, not just whoever moved it
      if (io) io.emit("predictionUpdated", { slug: prediction.slug, outcomes: view.outcomes.map(({ key, priceBps, volume }) => ({ key, priceBps, volume })) });

      res.json({
        prediction: view,
        walletBalance: user ? user.walletBalance : undefined,
        spent: result.spent,
        received: result.received,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  return router;
};
