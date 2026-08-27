import { test, expect } from "@playwright/test";

// 1x1 transparent png so case images load instantly with no network
const IMG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const cases = [
  { _id: "case1", title: "Starter Case", image: IMG, price: 100, category: "Event" },
  { _id: "case2", title: "Pro Case", image: IMG, price: 500 },
];

// mock every API call the home page makes so the suite needs no backend
test.beforeEach(async ({ page }) => {
  // a fresh context counts as a first visit, so the onboarding modal would
  // overlay the page and intercept every click below (it has its own spec)
  await page.addInitScript(() => localStorage.setItem("kani.onboardingSeen", "1"));
  await page.route("**/cases**", (route) => route.fulfill({ json: cases }));
  // registered after the catch-all so it wins: playwright matches newest route first.
  // empty by default, so the same case title never renders in two sections at once
  await page.route("**/cases/most-opened**", (route) => route.fulfill({ json: [] }));
  await page.route("**/topPlayers**", (route) => route.fulfill({ json: [] }));
  await page.route("**/ranking**", (route) =>
    route.fulfill({ json: { ranking: 0, users: [] } })
  );
  await page.route("**/marketplace**", (route) =>
    route.fulfill({ json: { totalPages: 0, currentPage: 1, items: [] } })
  );
});

// this is the regression that took the whole site down: a sticky header
// overlaid the page and intercepted clicks. Playwright's actionability checks
// fail ("element intercepts pointer events") if anything covers these targets.

test("a case on the home page is clickable and navigates", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Starter Case")).toBeVisible();
  await page.getByText("Starter Case").click();
  await expect(page).toHaveURL(/\/case\/case1/);
});

test("every game in the listing is clickable and navigates", async ({ page }) => {
  const games = [
    { text: "Play Crash", url: /\/crash/ },
    { text: "Play CoinFlip", url: /\/coinflip/ },
    { text: "Play Upgrade", url: /\/upgrade/ },
    { text: "Play Slot", url: /\/slot/ },
    { text: "Play Plinko", url: /\/plinko/ },
    { text: "Play Blackjack", url: /\/blackjack/ },
  ];

  for (const game of games) {
    await page.goto("/");
    await page.getByText(game.text).click();
    await expect(page).toHaveURL(game.url);
  }
});

test("a case section can be hidden and shown again", async ({ page }) => {
  await page.goto("/");
  // a case with no category pools into the Other section
  await expect(page.getByText("Other Cases")).toBeVisible();

  const section = page.locator("section").filter({ hasText: "Event Cases" });
  await expect(page.getByText("Starter Case")).toBeVisible();
  await section.getByRole("button", { name: /hide/i }).click();
  await expect(page.getByText("Starter Case")).toBeHidden();
  await section.getByRole("button", { name: /show/i }).click();
  await expect(page.getByText("Starter Case")).toBeVisible();
});

test("the most opened section renders above the games and category listings", async ({ page }) => {
  await page.route("**/cases/most-opened**", (route) =>
    route.fulfill({ json: [{ _id: "case9", title: "Hot Case", image: IMG, price: 250, opens: 42 }] })
  );
  await page.goto("/");

  await expect(page.getByText("Most Opened Cases")).toBeVisible();
  await expect(page.getByText("Hot Case")).toBeVisible();

  const topOf = async (text: string | RegExp) => {
    const el = page.getByText(text).first();
    if ((await el.count()) === 0) return null;
    const box = await el.boundingBox();
    return box ? box.y : null;
  };

  const ys = [
    await topOf("Most Opened Cases"),
    await topOf("Our Games"),
    await topOf(/^LEADERBOARD$/),
    await topOf("Event Cases"),
  ];
  expect(ys.every((y) => y !== null)).toBe(true);
  expect([...ys]).toEqual([...ys].sort((a, b) => (a as number) - (b as number)));

  // the discord block renders only when VITE_DISCORD_INVITE is set, which ci does not
  const discord = await topOf("Join our Discord");
  if (discord !== null) {
    expect(discord).toBeGreaterThan(ys[1] as number);
    expect(discord).toBeLessThan(ys[2] as number);
  }
});

test("the most opened section is absent when nothing has been opened", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Most Opened Cases")).toHaveCount(0);
});

test("the category bar lists a chip per shelf and jumps to it", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 500 });
  await page.goto("/");

  const bar = page.getByRole("navigation", { name: "Case categories" });
  await expect(bar.getByRole("button", { name: "Event" })).toBeVisible();

  const heading = page.getByText("Other Cases");
  const before = await heading.boundingBox();
  await bar.getByRole("button", { name: "Other" }).click();

  await expect
    .poll(async () => (await heading.boundingBox())?.y ?? Infinity)
    .toBeLessThan((before as { y: number }).y - 100);
});

// the sticky header regression again: a bar pinned to the top must not sit over the
// shelf it just scrolled to
test("a case stays clickable after the bar has scrolled to its shelf", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 500 });
  await page.goto("/");

  await page.getByRole("navigation", { name: "Case categories" }).getByRole("button", { name: "Other" }).click();
  await page.getByText("Pro Case").click();

  await expect(page).toHaveURL(/\/case\/case2/);
});

test("the category bar carries the most opened shelf only when it exists", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Case categories" });
  await expect(bar.getByRole("button", { name: "Event" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Most Opened" })).toHaveCount(0);

  await page.route("**/cases/most-opened**", (route) =>
    route.fulfill({ json: [{ _id: "case9", title: "Hot Case", image: IMG, price: 250, opens: 42 }] })
  );
  await page.goto("/");
  await expect(bar.getByRole("button", { name: "Most Opened" })).toBeVisible();
});

test("the home page fits a phone with the category bar on it", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Case categories" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

// the category bar is sticky and the login panel sits in a stacking context the header pins
// at z-20, so the modal's own z-[999] never escapes it. the bar shipped at z-30 and covered
// the sign-in form, which is invisible in the markup and obvious on screen.
// the poll is not padding: the header wrapper uses transition-all, which animates z-index
// itself (-10 -> 20 over 300ms), so the modal only wins once that has settled.
test("the login modal ends up above the category bar, not under it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  const bar = page.getByRole("navigation", { name: "Case categories" });
  await expect(bar).toBeVisible();

  await page.getByText("Sign In", { exact: true }).click();
  await expect(page.getByPlaceholder("Email address")).toBeVisible();

  const box = (await bar.boundingBox()) as { x: number; y: number };
  await expect
    .poll(() =>
      page.evaluate(
        ([x, y]) => {
          const el = document.elementFromPoint(x, y);
          return !!el && el.closest("nav[aria-label='Case categories']") !== null;
        },
        [box.x + 200, box.y + 10]
      )
    )
    .toBe(false);
});

test("a navbar link is clickable and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Market" }).first().click();
  await expect(page).toHaveURL(/\/marketplace/);
});

test("the games menu opens over the navbar and navigates", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Games" });
  await trigger.click();
  // the panel is portalled out of the navbar, whose clip-path would otherwise cut it off
  const hilo = page.getByRole("link", { name: "HiLo", exact: true });
  await expect(hilo).toBeVisible();
  await hilo.click();
  await expect(page).toHaveURL(/\/hilo/);
});

test("the games menu closes on escape", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Games" }).click();
  await expect(page.getByRole("link", { name: "Mines", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Mines", exact: true })).toHaveCount(0);
});
