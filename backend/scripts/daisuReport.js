// read-only: how players use daisu, from the usage record and the ledger. node scripts/daisuReport.js [days, default 7]
require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const MissionState = require("../models/MissionState");
const UsageEvent = require("../models/UsageEvent");
const { TX } = require("../utils/economy");
const { CHAPTERS } = require("../utils/roadmapCatalog");

// the rows a player's own hand writes, so a payout landing on an idle account does not count as a visit
const PLAYED = /_bet$|^case_open$|^bonus$|^shop_purchase$|^market_buy$|^battle_entry$|^item_sell$|^prediction_buy$|^mission_reward$/;
const TOUR = ["pot", "case", "open", "drop", "game", "bet", "range", "play", "done"];

const count = (rows, key) => rows.reduce((acc, r) => ((acc[key(r)] = (acc[key(r)] || 0) + 1), acc), {});
const line = (tally) => Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "none";
const players = (rows) => new Set(rows.map((r) => String(r.userId))).size;
const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
const secs = (s) => (s === null ? "-" : s < 90 ? `${s}s` : `${Math.round(s / 60)}m`);
const pct = (n, of) => (of ? `${Math.round((100 * n) / of)}%` : "-");

async function report(days) {
  const since = new Date(Date.now() - days * 86400000);
  const fromId = mongoose.Types.ObjectId.createFromTime(Math.floor(since.getTime() / 1000));
  const [rows, played, ledger] = await Promise.all([
    UsageEvent.find({ at: { $gte: since } }, { _id: 0, path: 0 }).sort({ at: 1 }).lean(),
    Transaction.distinct("userId", { _id: { $gte: fromId }, type: { $regex: PLAYED } }),
    Transaction.find(
      { _id: { $gte: fromId }, type: { $in: [TX.MISSION_REWARD, TX.SHOP_PURCHASE] } },
      { userId: 1, type: 1, meta: 1, createdAt: 1 }
    ).lean(),
  ]);
  const events = rows.map((e) => ({ ...e, params: e.params || {} }));
  // a player who only looked at her panels and never played is still a player she was shown to
  const ids = new Set([...played.map(String), ...events.map((e) => String(e.userId))]);
  const active = [...ids].map((id) => new mongoose.Types.ObjectId(id));
  const of = (name) => events.filter((e) => e.name === name);
  const out = [];
  const say = (s = "") => out.push(s);

  say(`Daisu, the last ${days} days (since ${since.toISOString().slice(0, 16)}Z)`);
  say(`${active.length} players were active: ${played.length} played, and ${players(events)} left usage events.`);

  const opens = of("daisu_open");
  const rooms = of("daisu_room");
  const closes = of("daisu_close");
  say("\nHer card and her room");
  say(`  opened her card: ${players(opens)} players (${pct(players(opens), active.length)}), ${opens.length} times. By: ${line(count(opens, (e) => e.params.via))}`);
  const fromBubble = opens.filter((e) => e.params.via === "bubble");
  if (fromBubble.length) say(`    the bubble was showing: ${line(count(fromBubble, (e) => e.params.showing))}; its dot was on for ${pct(fromBubble.filter((e) => e.params.attention).length, fromBubble.length)}`);
  say(`  opened her room: ${players(rooms)} players (${pct(players(rooms), active.length)}), ${rooms.length} times. By: ${line(count(rooms, (e) => e.params.via))}`);
  const upFor = closes.map((e) => e.params.secs).filter((s) => typeof s === "number");
  say(`  up for a median ${secs(median(upFor))}; left by: ${line(count(closes, (e) => e.params.via))}`);
  const quick = closes.filter((e) => e.params.via === "close" && typeof e.params.secs === "number" && e.params.secs < 3);
  say(`  closed within 3 seconds: ${quick.length} of ${closes.length}`);

  say("\nMissions");
  const states = await MissionState.find({ userId: { $in: active } }, { userId: 1, roadmap: 1 }).lean();
  const stand = count(states, (s) => `ch${(s.roadmap && s.roadmap.chapter) || 1}${((s.roadmap && s.roadmap.claimed) || []).length ? "" : " (none claimed)"}`);
  say(`  where the players stand: ${Object.entries(stand).sort().map(([k, n]) => `${k} ${n}`).join(", ")}`);
  const claims = ledger.filter((r) => r.type === TX.MISSION_REWARD && r.meta && /^r\d/.test(r.meta.missionKey || ""));
  const chapters = ledger.filter((r) => r.type === TX.MISSION_REWARD && r.meta && r.meta.chapterBonus);
  say(`  claimed: ${claims.length} by ${players(claims)} players. ${line(count(claims, (r) => r.meta.missionKey))}`);
  say(`  chapters finished: ${line(count(chapters, (r) => `ch${r.meta.roadmapChapter}`))}`);
  const openKeys = {};
  for (const s of states) {
    const r = s.roadmap || {};
    const chapter = CHAPTERS[(r.chapter || 1) - 1];
    if (!chapter || !(r.claimed || []).length) continue;
    for (const m of chapter.missions) if (!(r.claimed || []).includes(m.key)) openKeys[m.key] = (openKeys[m.key] || 0) + 1;
  }
  say(`  still open for players already moving in that chapter: ${line(openKeys)}`);
  say(`  asked what a mission means: ${line(count(of("mission_help"), (e) => e.params.mission))}`);
  const failedClaims = of("mission_claim_failed");
  if (failedClaims.length) say(`  claims that failed: ${line(count(failedClaims, (e) => `${e.params.mission} (${e.params.status})`))}`);

  say("\nShop");
  const looks = of("shop_item");
  const bought = ledger.filter((r) => r.type === TX.SHOP_PURCHASE);
  say(`  items looked at: ${looks.length} by ${players(looks)} players, as: ${line(count(looks, (e) => e.params.state))}`);
  say(`  bought: ${bought.length} by ${players(bought)} players`);
  const boughtBy = new Set(bought.map((r) => `${r.userId}:${r.meta && r.meta.unlock}`));
  const walked = looks.filter((e) => e.params.state === "open" && !boughtBy.has(`${e.userId}:${e.params.item}`));
  say(`  could buy, looked, did not: ${line(count(walked, (e) => e.params.item))}`);
  const failedBuys = of("shop_buy_failed");
  if (failedBuys.length) say(`  purchases that failed: ${line(count(failedBuys, (e) => `${e.params.item} (${e.params.status} ${e.params.reason || ""})`))}`);

  say("\nLocked pages");
  const seen = of("locked_view").filter((e) => e.params.unlock);
  for (const [unlock] of Object.entries(count(seen, (e) => e.params.unlock)).sort((a, b) => b[1] - a[1])) {
    const saw = seen.filter((e) => e.params.unlock === unlock);
    const went = rooms.filter((e) => e.params.via === "shop_link" && e.params.item === unlock);
    const got = bought.filter((r) => r.meta && r.meta.unlock === unlock);
    say(`  ${unlock}: seen by ${players(saw)} players, ${players(went)} went to her shop from it, ${players(got)} bought it`);
  }
  if (!seen.length) say("  none seen");

  say("\nShow me");
  const starts = of("help_start");
  say(`  started: ${line(count(starts, (e) => e.params.goal))}`);
  say(`  ended on: ${line(count(of("help_end"), (e) => `${e.params.goal}@${e.params.step}`))}`);

  say("\nTour");
  const steps = of("tour_step");
  const reached = TOUR.concat("skipped").map((step) => `${step} ${players(steps.filter((e) => e.params.step === step))}`);
  say(`  players reaching each step: ${reached.join(", ")}`);
  const bySid = {};
  for (const e of steps) (bySid[`${e.userId}:${e.sid}`] = bySid[`${e.userId}:${e.sid}`] || []).push(e);
  const spent = {};
  for (const run of Object.values(bySid)) {
    for (let i = 1; i < run.length; i++) (spent[run[i - 1].params.step] = spent[run[i - 1].params.step] || []).push(Math.round((run[i].at - run[i - 1].at) / 1000));
  }
  say(`  median time on each step: ${TOUR.filter((s) => spent[s]).map((s) => `${s} ${secs(median(spent[s]))}`).join(", ") || "none yet"}`);
  const tours = await User.aggregate([
    { $match: { _id: { $in: active }, "onboarding.status": { $ne: null } } },
    { $group: { _id: { status: "$onboarding.status", step: "$onboarding.step" }, n: { $sum: 1 } } },
  ]);
  say(`  where the players' tours stand: ${tours.sort((a, b) => b.n - a.n).map((t) => `${t._id.status}${t._id.step && t._id.status !== "done" ? `@${t._id.step}` : ""} ${t.n}`).join(", ")}`);

  return out.join("\n");
}

if (require.main === module) {
  const days = Math.max(1, Number(process.argv[2]) || 7);
  mongoose
    .connect(process.env.MONGO_URI, { readPreference: "secondaryPreferred" })
    .then(() => report(days))
    .then((text) => console.log(text))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { report };
