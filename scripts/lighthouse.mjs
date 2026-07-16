// runs the same audit pagespeed insights runs, locally, so a change can be measured
// before it ships instead of after.
//
//   npm run lh                        production, mobile (what pagespeed reports)
//   npm run lh -- http://localhost:4173/   a local preview build
//   npm run lh -- --desktop
//   npm run lh -- --json report.json  write the full lighthouse json
//
// mobile is the default on purpose: the desktop score has never been the problem.
// chrome comes from the copy playwright already installed, so there is nothing extra
// to set up.

import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith("http")) || "https://kanicasino.com/";
const desktop = args.includes("--desktop");
const jsonAt = args[args.indexOf("--json") + 1];
const wantJson = args.includes("--json");

const chromePath = () => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    // resolved lazily: the repo has playwright, and it ships a chromium
    return require("@playwright/test").chromium.executablePath();
  } catch {
    return undefined; // let chrome-launcher find a system chrome
  }
};

const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);

const chrome = await chromeLauncher.launch({
  chromePath: chromePath(),
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});

try {
  const config = desktop ? (await import("lighthouse/core/config/desktop-config.js")).default : undefined;
  const { lhr } = await lighthouse(url, { logLevel: "error", output: "json", port: chrome.port }, config);

  const pct = (s) => (s == null ? "?" : Math.round(s * 100));
  const bar = (s) => {
    const n = pct(s);
    return n >= 90 ? "good" : n >= 50 ? "ok" : "poor";
  };

  console.log(`\n${url}`);
  console.log(`${desktop ? "desktop" : "mobile, slow 4G, Moto G Power"} | lighthouse ${lhr.lighthouseVersion}\n`);

  for (const c of Object.values(lhr.categories)) {
    console.log(`  ${c.title.padEnd(20)} ${String(pct(c.score)).padStart(3)}  ${bar(c.score)}`);
  }

  console.log("");
  for (const id of [
    "first-contentful-paint",
    "largest-contentful-paint",
    "total-blocking-time",
    "cumulative-layout-shift",
    "speed-index",
  ]) {
    const a = lhr.audits[id];
    if (a) console.log(`  ${a.title.padEnd(26)} ${String(a.displayValue || "").padStart(7)}  ${bar(a.score)}`);
  }

  const opps = Object.values(lhr.audits)
    .filter((a) => a.details?.type === "opportunity" && a.details.overallSavingsMs >= 50)
    .sort((a, b) => b.details.overallSavingsMs - a.details.overallSavingsMs);
  if (opps.length) {
    console.log("\n  opportunities");
    for (const a of opps.slice(0, 8)) {
      console.log(`  ${String(Math.round(a.details.overallSavingsMs) + "ms").padStart(8)}  ${a.title}`);
    }
  }

  const el = lhr.audits["largest-contentful-paint-element"]?.details?.items;
  if (el?.[0]?.items?.[0]?.node?.snippet) {
    console.log(`\n  LCP element\n    ${el[0].items[0].node.snippet.slice(0, 120)}`);
  }
  if (el?.[1]?.items) {
    console.log("  LCP breakdown");
    for (const p of el[1].items) console.log(`    ${String(p.phase).padEnd(22)} ${p.timing} ms`);
  }

  if (wantJson) {
    const out = jsonAt && !jsonAt.startsWith("--") ? jsonAt : "lighthouse-report.json";
    writeFileSync(out, JSON.stringify(lhr, null, 2));
    console.log(`\n  full report written to ${out}`);
  }
  console.log("");
} finally {
  await chrome.kill();
}
