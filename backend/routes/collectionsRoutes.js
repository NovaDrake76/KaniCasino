const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Case = require("../models/Case");
const Item = require("../models/Item");
const User = require("../models/User");
const { sellValue } = require("../utils/itemValue");

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
