import { test, expect, Page } from "@playwright/test";

// the rail has been wrong three times: it pushed the whole page including the navbar, then
// it pushed centred boards that already had room beside them, then it left the full width
// footer sitting underneath itself. these assert the properties rather than the pixels.

const WIDE = { width: 1920, height: 950 };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kani.onboardingSeen", "1");
    localStorage.setItem("kani.chatOpen", "1");
  });
  await page.setViewportSize(WIDE);
});

const open = async (page: Page, route: string) => {
  await page.goto(route);
  await page.waitForTimeout(1600);
};

const railWidth = (page: Page) =>
  page.evaluate(() => {
    const rail = document.querySelector("aside");
    return rail ? Math.round(rail.getBoundingClientRect().width) : 0;
  });

// every block that actually paints something and is not the rail itself
const coveredBlocks = (page: Page) =>
  page.evaluate(() => {
    const rail = document.querySelector("aside");
    if (!rail) return [];
    const box = rail.getBoundingClientRect();
    const width = box.width;
    const hits: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      if (rail.contains(el) || el.contains(rail)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 200 || r.height < 20 || r.bottom < 0 || r.top > window.innerHeight) continue;
      // the navbar spans the window above the rail on purpose, so anything that clears
      // its top edge is not being covered by it
      if (r.bottom <= box.top + 1) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed") continue;
      const paints =
        el.tagName === "IMG" ||
        cs.backgroundImage !== "none" ||
        (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent");
      // an element parked off canvas, a carousel slide for one, reaches under the rail
      // without being covered by it: only something that starts on screen counts
      if (paints && r.left >= -1 && r.left < width - 2) {
        hits.push(`${el.tagName.toLowerCase()} at ${Math.round(r.left)}`);
      }
    }
    return hits;
  });

test("the navbar keeps the whole window, and the rail hangs under it", async ({ page }) => {
  await open(page, "/crash");
  expect(await railWidth(page)).toBeGreaterThan(0);

  const { navLeft, navRight, railTop, navBottom } = await page.evaluate(() => {
    const nav = document.querySelector("nav")!.getBoundingClientRect();
    const rail = document.querySelector("aside")!.getBoundingClientRect();
    return {
      navLeft: Math.round(nav.left),
      navRight: Math.round(window.innerWidth - nav.right),
      railTop: Math.round(rail.top),
      navBottom: Math.round(nav.bottom),
    };
  });

  // the navbar was pushed across with everything else the first time round
  expect(navLeft).toBeLessThan(40);
  expect(navRight).toBeLessThan(40);
  expect(railTop).toBeGreaterThanOrEqual(navBottom - 1);
});

test("a centred board keeps its place when its own margin can hold the rail", async ({ page }) => {
  // crash on a wide window already leaves more than the rail needs either side of the
  // board. it used to be shoved across regardless, which is churn for nothing.
  await open(page, "/crash");
  expect(await railWidth(page)).toBe(300);

  const contentLeft = () =>
    page.evaluate(() => {
      const host = document.getElementById("page-content")!;
      return Math.round(host.getBoundingClientRect().left + parseFloat(getComputedStyle(host).paddingLeft));
    });

  const opened = await contentLeft();

  // toggled rather than reloaded, so the init script cannot put the setting back
  await page.getByRole("button", { name: "Hide chat" }).click();
  await page.waitForTimeout(600);

  expect(await railWidth(page)).toBe(0);
  expect(await contentLeft()).toBe(opened);
});

for (const route of ["/", "/crash", "/market"]) {
  test(`nothing on ${route} ends up underneath the rail`, async ({ page }) => {
    await open(page, route);
    expect(await railWidth(page)).toBe(300);

    expect(await coveredBlocks(page)).toEqual([]);

    // the footer spans the window whatever the page does, so it is the one that got caught
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    expect(await coveredBlocks(page)).toEqual([]);
  });
}

test("the page never scrolls sideways with the rail open", async ({ page }) => {
  for (const route of ["/", "/crash", "/market", "/hilo"]) {
    await open(page, route);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${route} scrolls sideways`).toBeLessThanOrEqual(1);
  }
});

test("a window too narrow to hold a board and the rail does not dock it", async ({ page }) => {
  // docked at 1366 the crash board overflowed by 37px, undoing the short screen work
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, "/crash");

  expect(await railWidth(page)).toBe(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the arrow that closes the rail is where the one that reopens it appears", async ({ page }) => {
  // the toggle used to sit up in the navbar, a screen away from the panel it controls
  await open(page, "/crash");

  const closer = await page.getByRole("button", { name: "Hide chat" }).boundingBox();
  await page.getByRole("button", { name: "Hide chat" }).click();
  await page.waitForTimeout(500);

  expect(await railWidth(page)).toBe(0);
  const opener = await page.getByRole("button", { name: "Open chat" }).boundingBox();

  expect(opener).not.toBeNull();
  // same corner: within a rail's width of the left edge, and on the bottom row
  expect(opener!.x).toBeLessThan(120);
  expect(Math.abs(opener!.y - closer!.y)).toBeLessThan(80);

  await page.getByRole("button", { name: "Open chat" }).click();
  await page.waitForTimeout(600);
  expect(await railWidth(page)).toBe(300);
});
