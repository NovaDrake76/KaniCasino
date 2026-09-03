import { test, expect } from "@playwright/test";
import { mockApi } from "./mocks";

// the old form had one password box and no field level feedback, so a typo in it was only
// discovered the next time somebody tried to log in. the component tests mock the service
// away; this drives the real modal, so it catches the wiring between the two.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kani.onboardingSeen", "1"));
  await mockApi(page);
  await page.route("**/users/me**", (route) =>
    route.fulfill({
      json: {
        id: "new1", _id: "new1", username: "Sakuya", level: 1, xp: 0,
        walletBalance: 200, profilePicture: "", isAdmin: false,
      },
    })
  );
});

const openSignUp = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).first().click();
  await page.getByRole("button", { name: "Or create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
};

const submit = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Sign up", exact: true }).click();

test("an empty form points at every field instead of failing silently", async ({ page }) => {
  await openSignUp(page);

  await submit(page);

  await expect(page.getByText("This one is needed.")).toHaveCount(4);
});

test("each field says what is wrong with it as it is filled", async ({ page }) => {
  await openSignUp(page);

  await page.getByLabel("Nickname").fill("a");
  await page.getByLabel("Email", { exact: true }).fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill("123");
  await page.getByLabel("Repeat password").fill("456");
  await submit(page);

  await expect(page.getByText("At least 2 characters.")).toBeVisible();
  await expect(page.getByText("That does not look like an email address.")).toBeVisible();
  await expect(page.getByText("At least 6 characters.")).toBeVisible();
  await expect(page.getByText("The two passwords do not match.")).toBeVisible();
});

test("a mismatched repeat holds the form back rather than creating the account", async ({ page }) => {
  let posted = 0;
  await page.route("**/users/register**", (route) => {
    posted += 1;
    return route.fulfill({ json: { token: "t" } });
  });
  await openSignUp(page);

  await page.getByLabel("Nickname").fill("Sakuya");
  await page.getByLabel("Email", { exact: true }).fill("sakuya@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByLabel("Repeat password").fill("passwrd");
  await submit(page);

  await expect(page.getByText("The two passwords do not match.")).toBeVisible();
  expect(posted).toBe(0);
});

test("a filled in form registers and signs the player in", async ({ page }) => {
  let body: Record<string, unknown> = {};
  await page.route("**/users/register**", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ json: { token: "ok" } });
  });
  await openSignUp(page);

  await page.getByLabel("Nickname").fill("Sakuya");
  await page.getByLabel("Email", { exact: true }).fill("sakuya@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByLabel("Repeat password").fill("password");
  await submit(page);

  // the panel is hidden with css rather than unmounted, so the header is what says it worked
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
  expect(body.username).toBe("Sakuya");
  expect(body.email).toBe("sakuya@example.com");
});

test("the server's own reason is shown, not a generic retry", async ({ page }) => {
  await page.route("**/users/register**", (route) =>
    route.fulfill({ status: 400, json: { message: "That nickname is taken" } })
  );
  await openSignUp(page);

  await page.getByLabel("Nickname").fill("Sakuya");
  await page.getByLabel("Email", { exact: true }).fill("sakuya@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByLabel("Repeat password").fill("password");
  await submit(page);

  await expect(page.getByRole("alert")).toHaveText("That nickname is taken");
});

test("a password can be revealed, since it cannot be pasted from a manager here", async ({ page }) => {
  await openSignUp(page);
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("password");

  await expect(password).toHaveAttribute("type", "password");
  // the repeat field carries the same control, so this is the first of two
  await page.getByRole("button", { name: "Show password" }).first().click();

  await expect(password).toHaveAttribute("type", "text");
});
