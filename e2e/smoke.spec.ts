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
  await page.route("**/cases**", (route) => route.fulfill({ json: cases }));
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

test("a navbar link is clickable and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Market" }).first().click();
  await expect(page).toHaveURL(/\/marketplace/);
});
