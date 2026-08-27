import { test, expect } from "@playwright/test";

// A deploy replaces the hashed bundles while cloudflare is still handing out the previous
// html for up to five minutes. That shell asks for files the new build deleted, render
// answers a missing /assets/ path with a redirect to "/", and the browser refuses html
// where it wanted javascript. It took the site down for exactly that window once, and the
// only visible symptom is a white screen, so the recovery is worth pinning down.
test("a shell whose bundle no longer exists reloads itself onto one that does", async ({ page }) => {
  let served = 0;

  // the first request for the entry bundle gets what render actually returns for a path
  // with no file behind it: the html of the site root, with an html content type
  await page.route("**/assets/*.js", async (route) => {
    served += 1;
    if (served > 1) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><html><body></body></html>",
    });
  });

  await page.goto("/");

  // it must come back on its own, without a second visit
  await expect(page.locator("#root")).not.toBeEmpty({ timeout: 15000 });
  expect(served).toBeGreaterThan(1);
});

// The guard spends one retry per tab. A page that is broken for some other reason must not
// sit in a reload loop hammering the origin.
test("a bundle that never loads is retried once and then left alone", async ({ page }) => {
  let served = 0;
  await page.route("**/assets/*.js", async (route) => {
    served += 1;
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><html><body></body></html>",
    });
  });

  await page.goto("/");
  await page.waitForTimeout(4000);

  expect(served).toBe(2);
});

// the retry adds a cache-busting param to get past the edge copy, and that param has no
// business staying in the address bar afterwards
test("the cache-busting param is gone once the app is up", async ({ page }) => {
  await page.route("**/cases**", (route) => route.fulfill({ json: [] }));
  await page.route("**/topPlayers**", (route) => route.fulfill({ json: [] }));
  await page.route("**/ranking**", (route) => route.fulfill({ json: { ranking: 0, users: [] } }));

  await page.goto("/?r=1234567890");
  await expect(page.locator("#root")).not.toBeEmpty();

  await expect.poll(() => new URL(page.url()).searchParams.has("r")).toBe(false);
});
