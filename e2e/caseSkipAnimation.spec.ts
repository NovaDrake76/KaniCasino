import { test, expect, Page } from "@playwright/test";

// the stopwatch from daisu's shop puts a switch by the open button; with it on, an opening
// goes straight to the prize instead of spinning the reel for seven and a half seconds

const IMG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const items = Array.from({ length: 8 }, (_, i) => ({
  _id: `item${i}`,
  name: `Character ${i}`,
  image: IMG,
  rarity: String((i % 5) + 1),
  baseValue: 100,
}));

// a player in her beta whose tour is over, so nothing else talks over the case page
async function signIn(page: Page, unlocks: string[]) {
  // a dev backend on the same port would otherwise answer the calls these tests do not mock
  await page.route("**/localhost:5000/**", (route) => route.fulfill({ json: {} }));
  await page.addInitScript(() => {
    localStorage.setItem("kani.onboardingSeen", "1");
    localStorage.setItem("accessToken", "test-token");
    localStorage.setItem("kani.daisuStage", "bubble");
    // stored in this browser either way: only the item makes it count
    localStorage.setItem("kani.skipCaseAnimation", "1");
  });
  const fullAt = new Date(Date.now() + 60000).toISOString();
  await page.route("**/users/me**", (route) =>
    route.fulfill({
      json: {
        id: "u1",
        _id: "u1",
        username: "tester",
        walletBalance: 1000000,
        level: 45,
        xp: 0,
        inventory: [],
        nextBonus: fullAt,
        features: { daisu: true },
        unlocks,
        onboarding: { status: "done", step: "done" },
      },
    })
  );
  await page.route("**/daisu/status**", (route) =>
    route.fulfill({
      json: {
        fill: 0.2, full: 1000, amount: 200, fullAt, cycleMs: 480000, clickRate: 0.8, fullBonus: 0.25, creditShare: 0.1,
        pick: "dice", nextPick: "plinko", pickProgress: 0.2, creditTtlMs: 480000, bonuses: [],
      },
    })
  );
  await page.route("**/daisu/missions**", (route) =>
    route.fulfill({ json: { chapter: 1, chapters: 10, finished: false, bonus: 1000, missions: [], next: null } })
  );
  await page.route("**/daisu/shop**", (route) =>
    route.fulfill({ json: { level: 45, walletBalance: 1000000, items: [], hidden: 0, xpBoost: { all: 1 } } })
  );
  await page.route("**/gift/grants**", (route) => route.fulfill({ json: [] }));
  await page.route("**/usage", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/cases/case1**", (route) =>
    route.fulfill({ json: { _id: "case1", title: "Mejiro Dynasty Case", image: IMG, price: 100, items } })
  );
  await page.route("**/openCase/**", (route) =>
    route.fulfill({ json: { items: [{ ...items[4], uniqueId: "u0", sellValue: 60, rollId: "R0" }] } })
  );
}

// remembers whether a reel was ever drawn in the window: a reel is fifty slots of artwork
const watchForReel = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector('[data-tour="case-prize"]')!;
    const w = window as unknown as { reelSeen: boolean };
    w.reelSeen = false;
    new MutationObserver(() => {
      if (box.querySelectorAll("img").length > 10) w.reelSeen = true;
    }).observe(box, { childList: true, subtree: true });
  });

const reelSeen = (page: Page) => page.evaluate(() => (window as unknown as { reelSeen: boolean }).reelSeen);

test("a stopwatch holder with the switch on goes straight to the prize", async ({ page }) => {
  await signIn(page, ["stopwatch"]);
  await page.goto("/case/case1");
  await expect(page.getByText("Mejiro Dynasty Case")).toBeVisible();

  const toggle = page.getByRole("switch", { name: "Skip animation" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await watchForReel(page);
  await page.getByText(/Open case/i).first().click();

  // the reel alone takes seven and a half seconds, so the prize this early means it was skipped
  await expect(page.locator("#prize")).toBeVisible({ timeout: 3000 });
  expect(await reelSeen(page)).toBe(false);
  await expect(toggle).toBeEnabled();
});

test("without the stopwatch there is no switch, and a stored choice still spins the reel", async ({ page }) => {
  await signIn(page, []);
  await page.goto("/case/case1");
  await expect(page.getByText("Mejiro Dynasty Case")).toBeVisible();
  await expect(page.getByText(/Open case/i).first()).toBeVisible();

  await expect(page.getByRole("switch", { name: "Skip animation" })).toHaveCount(0);
  await expect(page.getByText("Skip animation")).toHaveCount(0);

  await watchForReel(page);
  await page.getByText(/Open case/i).first().click();

  await expect.poll(() => reelSeen(page), { timeout: 3000 }).toBe(true);
  await expect(page.locator("#prize")).toHaveCount(0);
});
