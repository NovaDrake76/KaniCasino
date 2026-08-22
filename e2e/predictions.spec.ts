import { test, expect, Page, Route } from "@playwright/test";

// the board and the market page, with the API mocked. what these are here to hold is the
// arithmetic at the edge: prices arrive as basis points and a percentage that is out by a
// factor of a hundred is the kind of thing that reads fine in review and is obvious to a
// player, and the quote a player is shown has to be the amount the trade panel commits to.

const market = {
  _id: "m1",
  slug: "kanna-sweeps",
  title: "Will Kanna sweep the poll",
  description: "Ends on friday",
  category: "Waifu",
  status: "open",
  volume: 1240,
  traders: 7,
  vigBps: 400,
  outcomes: [
    { key: "o1", label: "Yes", priceBps: 6200, volume: 800, shares: 0, avgPriceBps: 0, spent: 0 },
    { key: "o2", label: "No", priceBps: 4200, volume: 440, shares: 0, avgPriceBps: 0, spent: 0 },
  ],
};

const threeWay = {
  ...market,
  _id: "m3",
  slug: "who-tops-it",
  title: "Who tops the board",
  outcomes: [
    { key: "o1", label: "Kanna", priceBps: 5200, volume: 800, shares: 0, avgPriceBps: 0, spent: 0 },
    { key: "o2", label: "Rem", priceBps: 3000, volume: 440, shares: 0, avgPriceBps: 0, spent: 0 },
    { key: "o3", label: "Holo", priceBps: 2200, volume: 200, shares: 0, avgPriceBps: 0, spent: 0 },
  ],
};

const settled = {
  ...market,
  _id: "m2",
  slug: "who-won",
  title: "Who won last week",
  status: "resolved",
  resolvedOutcome: "o1",
  resolutionNote: "Counted on monday",
};

// the routes below match the page urls as well as the api calls, so anything that is not
// an xhr is handed back to the server: intercepting the navigation itself would serve the
// json as the document
const json = (body: unknown) => (route: Route) =>
  route.request().resourceType() === "document" ? route.fallback() : route.fulfill({ json: body });

async function mockApi(page: Page, detail = market) {
  await page.addInitScript(() => localStorage.setItem("kani.onboardingSeen", "1"));
  const board = { predictions: [market, threeWay, settled], totalPages: 1, currentPage: 1, categories: ["Waifu"] };
  const series = detail.outcomes.map((o) => ({
    key: o.key,
    label: o.label,
    points: [
      { at: "2026-08-01T00:00:00.000Z", priceBps: 5200 },
      { at: "2026-08-02T00:00:00.000Z", priceBps: o.priceBps },
    ],
  }));

  // regexes rather than globs: the list call carries a query string, and the routes under a
  // slug have to stay apart from the slug itself
  await page.route(/\/predictions(\?.*)?$/, json(board));
  await page.route(/\/predictions\/[^/?]+(\?.*)?$/, json(detail));
  await page.route(/\/predictions\/[^/]+\/history/, json({ series }));
  await page.route(/\/predictions\/[^/]+\/trades/, json({ trades: [] }));
}

test("the board shows a market at the price the server sent, not a hundred times it", async ({ page }) => {
  await mockApi(page);
  await page.goto("/predictions");

  // a yes-or-no card says the one number; a three-way card lists its outcomes
  await expect(page.getByText("Will Kanna sweep the poll")).toBeVisible();
  await expect(page.getByText("62% chance").first()).toBeVisible();
  await expect(page.getByText("52%").first()).toBeVisible();
  await expect(page.getByText("30%").first()).toBeVisible();
});

test("a yes-or-no market draws one line, not two mirrored ones", async ({ page }) => {
  await mockApi(page);
  await page.goto("/predictions/kanna-sweeps");
  await expect(page.getByText("62% chance")).toBeVisible();

  const lines = await page.evaluate(() => document.querySelector('svg[role="img"]')!.querySelectorAll("polyline").length);
  expect(lines).toBe(1);
  // and the two prices are the picker, so there is no outcome list restating them
  await expect(page.getByRole("button", { name: /^Yes/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^No/ })).toBeVisible();
});

test("a market with more than two outcomes draws them all", async ({ page }) => {
  await mockApi(page, threeWay);
  await page.goto("/predictions/who-tops-it");
  await expect(page.getByRole("heading", { name: "Who tops the board" })).toBeVisible();

  const lines = await page.evaluate(() => document.querySelector('svg[role="img"]')!.querySelectorAll("polyline").length);
  expect(lines).toBe(3);
  await expect(page.getByText("62% chance")).toHaveCount(0);
});

test("predictions is in the navbar, not behind the games menu", async ({ page }) => {
  await mockApi(page);
  await page.goto("/predictions");

  await expect(page.getByRole("link", { name: "Predictions" })).toBeVisible();
  await page.getByRole("button", { name: "Games" }).click();
  await expect(page.getByRole("link", { name: "Predictions" })).toHaveCount(1);
});

test("a market card opens its own page", async ({ page }) => {
  await mockApi(page);
  await page.goto("/predictions");
  await page.getByText("Will Kanna sweep the poll").click();
  await expect(page).toHaveURL(/\/predictions\/kanna-sweeps/);
  await expect(page.getByRole("heading", { name: "Will Kanna sweep the poll" })).toBeVisible();
});

test("a guest is asked to log in rather than shown a trade button that fails", async ({ page }) => {
  await mockApi(page);
  await page.goto("/predictions/kanna-sweeps");
  await expect(page.getByRole("button", { name: "Log in to trade" })).toBeVisible();
});

test("a resolved market says so and names the outcome", async ({ page }) => {
  await mockApi(page, settled);
  await page.goto("/predictions/who-won");
  await expect(page.getByText("Resolved: Yes")).toBeVisible();
  await expect(page.getByText("Counted on monday")).toBeVisible();
});

test("the market page fits a phone without scrolling sideways", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await mockApi(page);
  await page.goto("/predictions/kanna-sweeps");
  // an empty page never overflows, so the measurement only means something once the
  // market has actually rendered
  await expect(page.getByRole("heading", { name: "Will Kanna sweep the poll" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the board fits a phone too", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await mockApi(page);
  await page.goto("/predictions");
  await expect(page.getByText("Will Kanna sweep the poll")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
