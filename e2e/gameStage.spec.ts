import { test, expect, Page } from "@playwright/test";

// the crash and coin flip stages had their width taken from whatever happened to be
// inside them, so an empty game history collapsed the canvas to 130px and forty results
// stretched it back out to 768px. these tests assert the property that was broken rather
// than a magic number: the stage states its own width, so it is the same on a laptop and
// an ultrawide, and nothing inside it can move it.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kani.onboardingSeen", "1"));
});

const stageWidth = (page: Page) =>
  page.evaluate(() => {
    // crash draws to a canvas; coin flip spins a div. whichever is present is the stage.
    const el = document.querySelector("canvas") || document.querySelector(".coin");
    if (!el) return null;
    const box = el.closest("div.relative") || el.parentElement;
    return box ? Math.round(box.getBoundingClientRect().width) : null;
  });

async function open(page: Page, route: string) {
  await page.goto(route);
  await page.waitForTimeout(1200);
}

// forty results is an ordinary evening. before the fix this is what pushed the panel out.
async function fillHistory(page: Page) {
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("div")].find(
      (d) => d.className.includes("justify-end") && d.className.includes("h-[24px]")
    );
    if (!row) return;
    for (let i = 0; i < 40; i++) {
      const chip = document.createElement("div");
      chip.className = "min-h-[24px] min-w-[24px] rounded-lg p-2 bg-green-500";
      chip.innerHTML = "<span class='font-bold'>128.44x</span>";
      row.appendChild(chip);
    }
  });
  await page.waitForTimeout(400);
}

for (const route of ["/crash", "/coinflip"]) {
  test(`${route} keeps its stage width when the game history grows`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, route);

    const before = await stageWidth(page);
    expect(before).not.toBeNull();
    // a collapsed stage was 130px; anything near that is the bug coming back
    expect(before).toBeGreaterThan(600);

    await fillHistory(page);
    expect(await stageWidth(page)).toBe(before);
  });

  test(`${route} states its own width instead of taking the viewport's`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, route);
    const laptop = await stageWidth(page);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(600);
    const ultrawide = await stageWidth(page);

    expect(laptop).toBeGreaterThan(600);
    expect(ultrawide).toBe(laptop);
  });

  test(`${route} fills a phone without pushing the page sideways`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, route);

    const width = await stageWidth(page);
    expect(width).toBeGreaterThan(300);
    expect(width).toBeLessThanOrEqual(390);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });
}
