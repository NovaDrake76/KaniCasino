import { test, expect } from "@playwright/test";

// same no-backend mocks as smoke.spec.ts, but without seeding the seen flag:
// a fresh context is exactly the first visit the onboarding is for
test.beforeEach(async ({ page }) => {
  await page.route("**/cases**", (route) => route.fulfill({ json: [] }));
  await page.route("**/cases/most-opened**", (route) => route.fulfill({ json: [] }));
  await page.route("**/topPlayers**", (route) => route.fulfill({ json: [] }));
  await page.route("**/ranking**", (route) =>
    route.fulfill({ json: { ranking: 0, users: [] } })
  );
  await page.route("**/marketplace**", (route) =>
    route.fulfill({ json: { totalPages: 0, currentPage: 1, items: [] } })
  );
});

test("the onboarding shows on a first visit and stays gone once dismissed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Welcome to KaniCasino!")).toBeVisible();

  await page.getByRole("button", { name: "Got it, let's play!" }).click();
  await expect(page.getByText("Welcome to KaniCasino!")).toBeHidden();

  // the page is usable again: a navbar link is clickable
  await page.getByRole("link", { name: "Market" }).first().click();
  await expect(page).toHaveURL(/\/marketplace/);

  await page.goto("/");
  await expect(page.getByText("Welcome to KaniCasino!")).toHaveCount(0);
});
