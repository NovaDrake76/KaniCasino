// screenshots the live carousel so the plate/lockup pairing can be checked in the real
// layout rather than trusting the renders. usage: npm run preview, then node this.
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out", "verify");

const browser = await chromium.launch();

for (const width of [1920, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 700 } });
  await page.goto("http://localhost:4173/", { waitUntil: "domcontentloaded" });
  // the first-visit modal sits over the hero, so mark it seen and reload
  await page.evaluate(() => localStorage.setItem("kani.onboardingSeen", "1"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const hero = page.locator(".carousel-root").first();
  // slides rotate every 7s, so walk through them rather than fighting the timer
  for (let i = 0; i < 7; i++) {
    await hero.screenshot({ path: path.join(out, `w${width}-slide${i}.png`) });
    await page.waitForTimeout(7100);
  }
  console.log("captured", width);
  await page.close();
}

await browser.close();
