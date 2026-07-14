const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Case = require("../models/Case");
const Item = require("../models/Item");
const User = require("../models/User");
const { sellValue } = require("../utils/itemValue");
const { sellUniqueIds } = require("../utils/inventorySell");
const { isAuthenticated } = require("../middleware/authMiddleware");

const PAGE_SIZE = 18;
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const round1 = (n) => Math.round(n * 10) / 10;

// an owned item belongs to a case's collection iff its catalog _id is in
// Case.items (the authoritative slot set). completion, duplicate value and the
// quicksell scope all use this one rule, so they can never disagree.

// count owned copies and gather the uniqueIds per catalog item _id
function indexInventory(inventory) {
  const countById = new Map();
  const uniqueIdsById = new Map();
  for (const e of inventory || []) {
    if (!e || !e._id) continue;
    const id = String(e._id);
    countById.set(id, (countById.get(id) || 0) + 1);
    if (!uniqueIdsById.has(id)) uniqueIdsById.set(id, []);
    uniqueIdsById.get(id).push(e.uniqueId);
  }
  return { countById, uniqueIdsById };
}

// the canonical quicksell plan for a case: for every item in Case.items the viewer
// owns more than one of (and that has a positive sell value), sell all but one. the
// kept copy is the oldest (createdAt asc, uniqueId asc as a total-order tiebreak) so
// two runs always agree on which copy survives. extras (owned but no longer in the
// case) are never swept. returns { lines, plan, totalItems, totalValue }, where plan
// is the sorted, flat list of uniqueIds to sell.
function computeQuicksellPlan(inventory, caseDoc) {
  const items = (caseDoc.items || []).filter(Boolean);
  const metaById = new Map(
    items.map((it) => [
      String(it._id),
      { baseValue: it.baseValue || 0, name: it.name, image: it.image, rarity: it.rarity },
    ])
  );

  const byItem = new Map();
  for (const e of inventory || []) {
    if (!e || !e._id) continue;
    const id = String(e._id);
    if (!metaById.has(id)) continue; // per-case scope = the case's slots only
    if (!byItem.has(id)) byItem.set(id, []);
    byItem.get(id).push(e);
  }

  const lines = [];
  const plan = [];
  for (const [id, entries] of byItem) {
    const meta = metaById.get(id);
    const unit = sellValue(meta.baseValue);
    const owned = entries.length;
    if (owned <= 1 || unit <= 0) continue; // no duplicate, or nothing to gain -> keep all
    entries.sort(
      (a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt) ||
        (a.uniqueId < b.uniqueId ? -1 : a.uniqueId > b.uniqueId ? 1 : 0)
    );
    const sellEntries = entries.slice(1); // keep entries[0]
    for (const s of sellEntries) plan.push(s.uniqueId);
    lines.push({
      _id: id,
      name: meta.name,
      image: meta.image,
      rarity: meta.rarity,
      owned,
      sellCount: sellEntries.length,
      unitSellValue: unit,
      lineValue: unit * sellEntries.length,
    });
  }

  lines.sort(
    (a, b) =>
      Number(b.rarity) - Number(a.rarity) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  );
  plan.sort();

  return {
    lines,
    plan,
    totalItems: plan.length,
    totalValue: lines.reduce((s, l) => s + l.lineValue, 0),
  };
}

function caseStats(caseDoc, countById) {
  const items = (caseDoc.items || []).filter(Boolean);
  const slotsTotal = items.length;
  let slotsOwned = 0;
  let duplicatesValue = 0;
  let duplicatesCount = 0;
  for (const it of items) {
    const owned = countById.get(String(it._id)) || 0;
    if (owned > 0) slotsOwned += 1;
    const dups = Math.max(owned - 1, 0);
    duplicatesCount += dups;
    duplicatesValue += dups * sellValue(it.baseValue);
  }
  return {
    slotsTotal,
    slotsOwned,
    duplicatesValue,
    duplicatesCount,
    completionPct: slotsTotal ? round1((100 * slotsOwned) / slotsTotal) : 0,
    complete: slotsTotal > 0 && slotsOwned === slotsTotal,
  };
}

// GET /collections/summary?userId= : every case with the viewer's progress
router.get("/summary", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!isValidId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const user = await User.findById(userId, { inventory: 1 });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { countById } = indexInventory(user.inventory);
    const cases = await Case.find({}, { title: 1, image: 1, price: 1, items: 1 })
      .populate("items", "rarity baseValue");

    const collections = cases.map((c) => ({
      caseId: c._id,
      title: c.title,
      image: c.image,
      price: c.price,
      ...caseStats(c, countById),
    }));

    const totals = collections.reduce(
      (acc, c) => {
        acc.slotsTotal += c.slotsTotal;
        acc.slotsOwned += c.slotsOwned;
        acc.duplicatesValue += c.duplicatesValue;
        acc.duplicatesCount += c.duplicatesCount;
        if (c.complete) acc.casesComplete += 1;
        return acc;
      },
      {
        cases: collections.length,
        casesComplete: 0,
        slotsTotal: 0,
        slotsOwned: 0,
        duplicatesValue: 0,
        duplicatesCount: 0,
      }
    );
    totals.completionPct = totals.slotsTotal
      ? round1((100 * totals.slotsOwned) / totals.slotsTotal)
      : 0;

    res.json({ userId, totals, collections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /collections/quicksell/preview : what a per-case quicksell would sell now.
// a pure read; drives the confirmation modal. always the caller's own inventory.
router.post("/quicksell/preview", isAuthenticated, async (req, res) => {
  try {
    const { caseId } = req.body;
    if (!isValidId(caseId)) {
      return res.status(400).json({ message: "Invalid case id" });
    }
    const caseDoc = await Case.findById(caseId)
      .populate("items", "name image rarity baseValue");
    if (!caseDoc) {
      return res.status(404).json({ message: "Case not found" });
    }
    const user = await User.findById(req.user._id, { inventory: 1 });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const plan = computeQuicksellPlan(user.inventory, caseDoc);
    res.json({ caseId: String(caseDoc._id), ...plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /collections/quicksell/commit : sell the duplicates the user just confirmed.
// destructive. the client echoes the exact plan (uniqueIds) the modal showed; the
// server recomputes the canonical plan from live inventory and only sells if the two
// match exactly. any drift -> sell nothing, hand back a fresh preview to re-confirm,
// so the user can never sell a set different from what they saw. identity is always
// req.user; a body userId is ignored.
router.post("/quicksell/commit", isAuthenticated, async (req, res) => {
  try {
    const { caseId, plan } = req.body;
    if (!isValidId(caseId)) {
      return res.status(400).json({ message: "Invalid case id" });
    }
    if (!Array.isArray(plan)) {
      return res.status(400).json({ message: "Missing plan" });
    }

    const caseDoc = await Case.findById(caseId)
      .populate("items", "name image rarity baseValue");
    if (!caseDoc) {
      return res.status(404).json({ message: "Case not found" });
    }
    const user = await User.findById(req.user._id, { inventory: 1 });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const current = computeQuicksellPlan(user.inventory, caseDoc);
    const confirmed = [...new Set(plan.map(String))].sort();
    const canonical = current.plan; // already de-duped + sorted

    const matches =
      confirmed.length === canonical.length &&
      confirmed.every((id, i) => id === canonical[i]);

    if (!matches) {
      // the sale drifted since the preview: sell nothing, ask for a fresh confirm
      return res.json({ changed: true, caseId: String(caseDoc._id), ...current });
    }

    if (!canonical.length) {
      return res.json({
        changed: false,
        sold: 0,
        value: 0,
        walletBalance: user.walletBalance,
      });
    }

    const result = await sellUniqueIds(req.user._id, canonical, {
      source: "quicksell",
      caseId: String(caseDoc._id),
    });
    if (!result) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      changed: false,
      sold: result.sold,
      value: result.value,
      walletBalance: result.walletBalance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /collections/:caseId?userId=&page=&filter=&sortBy= : one album
router.get("/:caseId", async (req, res) => {
  try {
    const { caseId } = req.params;
    const { userId } = req.query;
    if (!isValidId(caseId)) {
      return res.status(404).json({ message: "Collection not found" });
    }
    if (!isValidId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const caseDoc = await Case.findById(caseId)
      .populate("items", "name image rarity baseValue");
    if (!caseDoc) {
      return res.status(404).json({ message: "Collection not found" });
    }
    const user = await User.findById(userId, { inventory: 1 });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { countById, uniqueIdsById } = indexInventory(user.inventory);
    const items = (caseDoc.items || []).filter(Boolean);
    const caseItemIds = new Set(items.map((it) => String(it._id)));
    const stats = caseStats(caseDoc, countById);

    let rows = items.map((it) => {
      const id = String(it._id);
      const owned = countById.get(id) || 0;
      const sv = sellValue(it.baseValue);
      const duplicates = Math.max(owned - 1, 0);
      return {
        _id: id,
        name: it.name,
        image: it.image,
        rarity: it.rarity,
        baseValue: it.baseValue || 0,
        sellValue: sv,
        owned,
        duplicates,
        duplicateValue: duplicates * sv,
        status: owned > 0 ? "owned" : "missing",
        inCase: true,
        uniqueIds: uniqueIdsById.get(id) || [],
      };
    });

    const { filter, sortBy } = req.query;
    if (filter === "owned") rows = rows.filter((r) => r.owned > 0);
    else if (filter === "missing") rows = rows.filter((r) => r.owned === 0);
    else if (filter === "duplicates") rows = rows.filter((r) => r.duplicates > 0);

    // default rarest-first; name as a stable tiebreak
    const dir = sortBy === "mostCommon" ? 1 : -1;
    rows.sort(
      (a, b) =>
        (Number(a.rarity) - Number(b.rarity)) * dir ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    );

    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const paged = rows.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE);

    // extras: copies the viewer owns that were once in this case (snapshot .case)
    // but are no longer in its item list. shown read-only; never quicksold.
    const extraSnap = new Map();
    const extraCounts = new Map();
    const extraUniqueIds = new Map();
    for (const e of user.inventory || []) {
      if (!e || !e._id) continue;
      const id = String(e._id);
      if (String(e.case) !== String(caseId) || caseItemIds.has(id)) continue;
      extraCounts.set(id, (extraCounts.get(id) || 0) + 1);
      if (!extraSnap.has(id)) {
        extraSnap.set(id, { name: e.name, image: e.image, rarity: e.rarity });
      }
      if (!extraUniqueIds.has(id)) extraUniqueIds.set(id, []);
      extraUniqueIds.get(id).push(e.uniqueId);
    }

    let extras = [];
    if (extraCounts.size) {
      const exDocs = await Item.find(
        { _id: { $in: [...extraCounts.keys()] } },
        { baseValue: 1 }
      );
      const baseById = new Map(exDocs.map((i) => [String(i._id), i.baseValue || 0]));
      extras = [...extraCounts.entries()].map(([id, owned]) => {
        const snap = extraSnap.get(id) || {};
        const base = baseById.get(id) || 0; // deleted source -> 0, not sellable
        const sv = sellValue(base);
        const duplicates = Math.max(owned - 1, 0);
        return {
          _id: id,
          name: snap.name || "Unknown item",
          image: snap.image || "",
          rarity: snap.rarity || "1",
          baseValue: base,
          sellValue: sv,
          owned,
          duplicates,
          duplicateValue: duplicates * sv,
          status: "owned",
          inCase: false,
          uniqueIds: extraUniqueIds.get(id) || [],
        };
      });
    }

    res.json({
      caseId: String(caseDoc._id),
      title: caseDoc.title,
      image: caseDoc.image,
      price: caseDoc.price,
      ...stats,
      currentPage: page,
      totalPages,
      items: paged,
      extras,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
