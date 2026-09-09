// renders hero banners from a config, so adding a slide is an edit here rather than work
// in a design tool. two files per banner:
//   <name>-plate.png   1920x460 background, subject near the middle
//   <name>-lockup.png  transparent wordmark for the carousel's right slot
//
// the split matters: Banner.tsx paints the plate with bg-cover, which crops the edges on
// any viewport under 1920, so baked-in text near a side disappears. the lockup is DOM and
// stays put at every width.
//
// usage (from repo root): node tools/banners/render.mjs [name]
// a name renders that one banner only, so adding a slide does not re-render the others
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync } from "fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..", "..");
const outDir = path.join(here, "out");

// dairi's touhou sprites, already shipped as the blackjack court cards
const touhou = (f) => pathToFileURL(path.join(repo, "public", "images", "cards", f)).href;
// case and item art is fetched from the bucket at render time rather than copied in, so
// no third-party art lands in the repo. rendering needs network.
const BUCKET = "https://kanicases.s3.amazonaws.com";
const item = (p) => `${BUCKET}/${p}`;
// one-off inputs that stay out of git: the steam capsule for a giveaway lives at the repo
// root while the slide runs and is deleted with it
const local = (f) => pathToFileURL(path.join(repo, f)).href;

const BANNERS = [
  {
    // a 24 hour discord giveaway of the touhou 6 steam release. the capsule is the prize
    // itself, the two scarlet devils are the ones on its cover
    name: "touhou-giveaway",
    title: "GIVEAWAY",
    sub: "NEW TOUHOU 6 ON STEAM",
    seed: 6,
    motif: "capsule",
    capsule: local("touhou.png"),
    subjects: [
      { src: touhou("flandre.webp"), height: 370, left: 1000, z: 4 },
      { src: touhou("remilia.webp"), height: 380, left: 505, z: 4 },
    ],
    theme: {
      base: "#5A0E20", dark: "#170408", mid: "#B8213C",
      glow: "rgba(255,84,118,.40)", lift: "rgba(255,150,175,.16)",
      ring: "rgba(255,175,195,.20)", streak: "rgba(255,215,225,.10)",
      motif: "#FFD9E1",
      ink: "#FFFFFF", "ink-shadow": "#7A0E27", "glow-text": "rgba(255,84,118,.55)",
      accent: "#FFD34F",
    },
  },
  {
    name: "blackjack",
    title: "BLACKJACK",
    sub: "BEAT THE DEALER",
    seed: 5,
    motif: "cards",
    subjects: [{ src: touhou("sakuya.webp"), height: 405, left: 660, z: 3 }],
    theme: {
      base: "#0C4030", dark: "#04150F", mid: "#12694C",
      glow: "rgba(80,230,170,.30)", lift: "rgba(140,255,210,.12)",
      ring: "rgba(150,255,215,.16)", streak: "rgba(210,255,235,.08)",
      motif: "#BFF3DD",
      ink: "#FFFFFF", "ink-shadow": "#0A5138", "glow-text": "rgba(80,230,170,.5)",
      accent: "#FFD34F",
    },
  },
  {
    name: "plinko",
    title: "PLINKO",
    sub: "DROP IT AND WATCH",
    seed: 9,
    motif: "plinko",
    subjects: [{ src: touhou("cirno.webp"), height: 395, left: 700, z: 3 }],
    theme: {
      base: "#123A73", dark: "#050E24", mid: "#2E86C8",
      glow: "rgba(120,220,255,.36)", lift: "rgba(160,210,255,.16)",
      ring: "rgba(180,230,255,.18)", streak: "rgba(220,245,255,.09)",
      motif: "#CDEBFF",
      ink: "#FFFFFF", "ink-shadow": "#0C4585", "glow-text": "rgba(120,220,255,.55)",
      accent: "#7FE3FF",
    },
  },
  {
    name: "counter-strike",
    title: "COUNTER-STRIKE",
    sub: "COLLECT THE RAREST",
    seed: 41,
    subjects: [
      { src: item("csgo/Field_Agent.png"), height: 195, left: 300, bottom: 150, z: 1, opacity: 0.55 },
      { src: item("csgo/Printstream.png"), height: 320, left: 560, bottom: 70, z: 3 },
    ],
    theme: {
      base: "#20344A", dark: "#080D16", mid: "#C87A22",
      glow: "rgba(255,170,60,.36)", lift: "rgba(120,160,200,.16)",
      ring: "rgba(255,200,120,.18)", streak: "rgba(255,220,170,.10)",
      motif: "#FFD9A6",
      ink: "#FFFFFF", "ink-shadow": "#7A3F0A", "glow-text": "rgba(255,170,60,.5)",
      accent: "#FFB43F",
    },
  },
  {
    name: "blue-archive",
    title: "BLUE ARCHIVE",
    sub: "FOUR NEW CASES",
    seed: 11,
    subjects: [
      { src: item("cases/bluearchive/cover-trinity.webp"), height: 330, left: 855, z: 2, opacity: 0.95 },
      { src: item("cases/bluearchive/cover-kivotos.webp"), height: 405, left: 570, z: 3 },
    ],
    theme: {
      base: "#0E2A5C", dark: "#050B1E", mid: "#1C5FA8",
      glow: "rgba(79,216,255,.40)", lift: "rgba(120,180,255,.16)",
      ring: "rgba(160,220,255,.22)", streak: "rgba(200,240,255,.10)",
      motif: "#CDEBFF",
      ink: "#FFFFFF", "ink-shadow": "#0B3A7A", "glow-text": "rgba(79,216,255,.55)",
      accent: "#FFD34F",
    },
  },
  {
    name: "uma-musume",
    title: "UMA MUSUME",
    sub: "FIVE CASES, ONE WINNER",
    seed: 23,
    subjects: [{ src: item("cases/umamusume/cover-spica.webp"), height: 410, left: 640, z: 3 }],
    theme: {
      base: "#3E1B5C", dark: "#150720", mid: "#8A3FA0",
      glow: "rgba(255,150,220,.38)", lift: "rgba(190,140,255,.18)",
      ring: "rgba(255,190,240,.20)", streak: "rgba(255,225,250,.10)",
      motif: "#F3D6FF",
      ink: "#FFFFFF", "ink-shadow": "#5B1E6E", "glow-text": "rgba(255,140,215,.55)",
      accent: "#7FE7D0",
    },
  },
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 800 } });

const only = process.argv[2];
for (const cfg of BANNERS.filter((c) => !only || c.name === only)) {
  await page.goto(pathToFileURL(path.join(here, "template.html")).href);
  await page.evaluate((c) => window.render(c), cfg);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");

  await page.locator("#plate").screenshot({ path: path.join(outDir, `${cfg.name}-plate.png`) });
  await page.locator("#lockup").screenshot({
    path: path.join(outDir, `${cfg.name}-lockup.png`),
    omitBackground: true,
  });
  console.log("rendered", cfg.name);
}

await browser.close();
