import { test, expect, Page } from "@playwright/test";

// the case page was drawn at desktop width. on a phone the five-reel spin ran 189px past
// the edge of the screen, and the result was then squeezed into a 40vw box with 48px
// thumbnails and its own scrollbar. these assert what a phone needs rather than a size,
// so they hold at any width.

const IMG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const items = Array.from({ length: 8 }, (_, i) => ({
  _id: `item${i}`,
  name: `Character With A Long Name ${i}`,
  image: IMG,
  rarity: String((i % 5) + 1),
  baseValue: 100,
}));

const opened = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    ...items[i % items.length],
    uniqueId: `u${i}`,
    sellValue: 60,
    rollId: `R${i}`,
  }));

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  // a dev backend on the same port would otherwise answer the calls these tests do not
  // mock, and its 401 opens the login modal over everything
  await page.route("**/localhost:5000/**", (route) => route.fulfill({ json: {} }));
  await page.addInitScript(() => {
    localStorage.setItem("kani.onboardingSeen", "1");
    localStorage.setItem("accessToken", "test-token");
  });
  await page.route("**/users/me**", (route) =>
    route.fulfill({
      json: { id: "u1", username: "tester", walletBalance: 100000, level: 5, xp: 0, inventory: [] },
    })
  );
  await page.route("**/cases/case1**", (route) =>
    route.fulfill({ json: { _id: "case1", title: "Mejiro Dynasty Case", image: IMG, price: 100, items } })
  );
});

// how far the worst element reaches past either edge of the screen
const pastTheEdge = (page: Page) =>
  page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    let worst = 0;
    for (const el of document.querySelectorAll("body *")) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      worst = Math.max(worst, Math.round(box.right - limit), Math.round(-box.left));
    }
    return worst;
  });

async function open(page: Page, quantity: number) {
  await page.route("**/openCase/**", (route) => route.fulfill({ json: { items: opened(quantity) } }));
  await page.goto("/case/case1");
  await expect(page.getByText("Mejiro Dynasty Case")).toBeVisible();
  const plus = page.locator("div").filter({ hasText: /^\+$/ }).last();
  for (let i = 1; i < quantity; i++) await plus.click();
  await page.getByText(/Open case/i).first().click();
}

test("five reels stay on screen while they spin", async ({ page }) => {
  await open(page, 5);
  await page.waitForTimeout(2500);
  expect(await pastTheEdge(page)).toBeLessThanOrEqual(2);
});

test("five prizes use the width of the phone instead of a scrolling sliver", async ({ page }) => {
  await open(page, 5);
  await expect(page.locator("#prize").first()).toBeVisible({ timeout: 15000 });
  expect(await page.locator("#prize").count()).toBe(5);

  const row = page.locator("#prize").first().locator("xpath=..");
  const box = (await row.boundingBox())!;
  expect(box.width).toBeGreaterThan(300);

  // and it lays them out rather than hiding four behind a scrollbar
  const clipped = await row.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(clipped).toBeLessThanOrEqual(1);
  expect(await pastTheEdge(page)).toBeLessThanOrEqual(2);
});

test("a single prize is drawn big enough to see, with its name", async ({ page }) => {
  await open(page, 1);
  await expect(page.locator("#prize")).toBeVisible({ timeout: 15000 });

  const art = page.locator("#prize img").first();
  const box = (await art.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(120);

  // the card that carries the name on a wide screen has no room to open on a phone
  await expect(page.getByText("Character With A Long Name 0").first()).toBeVisible();
});

// halving the slot for a phone without moving the animation with it sent the strip past
// its own end: three of the five reels showed nothing for the rest of the spin
for (const { label, viewport, quantity } of [
  { label: "one reel", viewport: { width: 390, height: 844 }, quantity: 1 },
  { label: "five reels", viewport: { width: 390, height: 844 }, quantity: 5 },
  { label: "one reel on a desktop", viewport: { width: 1440, height: 900 }, quantity: 1 },
]) {
  test(`${label} keeps items in the window for the whole spin`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page, quantity);

    // every reel has to be showing something at every point of the seven-second spin
    for (let elapsed = 1000; elapsed <= 6500; elapsed += 1500) {
      await page.waitForTimeout(1500);
      const showing = await page.evaluate(() => {
        const reel = document.querySelector("div.border-y-4")!.getBoundingClientRect();
        return [...document.querySelectorAll("img")].filter((img) => {
          const b = img.getBoundingClientRect();
          return (
            b.height > 20 &&
            b.bottom > reel.top && b.top < reel.bottom &&
            b.right > reel.left && b.left < reel.right
          );
        }).length;
      });
      expect(showing, `only ${showing} slots visible ${elapsed}ms in`).toBeGreaterThanOrEqual(quantity);
    }
  });
}

// the arrows are the only thing saying which slot wins. at half size they sat outside the
// reel entirely on a single spin, and behind the artwork on five
for (const quantity of [1, 5]) {
  test(`the winning-slot arrows are visible with ${quantity} reel(s)`, async ({ page }) => {
    await open(page, quantity);
    await page.waitForTimeout(2000);

    const marks = await page.evaluate(() => {
      const reel = document.querySelector("div.border-y-4")!.getBoundingClientRect();
      return [...document.querySelectorAll('img[src*="reelMarker"]')].map((m) => {
        const b = m.getBoundingClientRect();
        const overlapX = Math.min(b.right, reel.right) - Math.max(b.left, reel.left);
        const overlapY = Math.min(b.bottom, reel.bottom) - Math.max(b.top, reel.top);
        return { w: Math.round(b.width), h: Math.round(b.height), overlap: Math.round(Math.max(0, overlapX) * Math.max(0, overlapY)) };
      });
    });

    expect(marks).toHaveLength(2);
    for (const m of marks) {
      expect(Math.min(m.w, m.h), `arrow only ${m.w}x${m.h}`).toBeGreaterThanOrEqual(30);
      // it points at the winning slot, so most of it has to be over the reel
      expect(m.overlap / (m.w * m.h), "arrow mostly outside the reel").toBeGreaterThanOrEqual(0.4);
    }
  });
}
