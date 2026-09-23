import { test, expect, Page } from "@playwright/test";
import { mockApi } from "./mocks";

type Batch = { sid: string; events: { name: string; params: Record<string, unknown>; path: string; ago: number }[] };

// a player in daisu's beta whose tour is over, so her dock is there and nothing else talks over it
async function signInWithDaisu(page: Page) {
  const fullAt = new Date(Date.now() + 60000).toISOString();
  await page.route("**/users/me**", (route) =>
    route.fulfill({
      json: {
        id: "player1",
        _id: "player1",
        username: "tester",
        level: 12,
        xp: 1000,
        walletBalance: 5000,
        profilePicture: "",
        isAdmin: false,
        nextBonus: fullAt,
        features: { daisu: true },
        unlocks: [],
        onboarding: { status: "done", step: "done" },
      },
    })
  );
  await page.route("**/daisu/status**", (route) =>
    route.fulfill({
      json: {
        fill: 0.9, full: 1000, amount: 700, fullAt, cycleMs: 480000, clickRate: 0.8, fullBonus: 0.25, creditShare: 0.1,
        pick: "dice", nextPick: "plinko", pickProgress: 0.2, creditTtlMs: 480000, bonuses: [],
      },
    })
  );
  await page.route("**/daisu/missions**", (route) =>
    route.fulfill({ json: { chapter: 1, chapters: 10, finished: false, bonus: 1000, missions: [], next: null } })
  );
  await page.route("**/daisu/shop**", (route) =>
    route.fulfill({ json: { level: 12, walletBalance: 5000, items: [], hidden: 0, xpBoost: { all: 1 } } })
  );
  await page.addInitScript(() => {
    localStorage.setItem("accessToken", "e2e-token");
    localStorage.setItem("kani.onboardingSeen", "1");
  });
}

test("opening her card and her room is recorded, and sent when the tab is hidden", async ({ page }) => {
  await mockApi(page);
  await signInWithDaisu(page);
  const batches: Batch[] = [];
  await page.route("**/usage", async (route) => {
    const req = route.request();
    if (req.method() === "POST") batches.push(JSON.parse(req.postData() || "{}"));
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open Daisu" }).click();
  await page.getByRole("button", { name: /visit daisu's room/i }).click();
  await expect(page.getByRole("dialog", { name: /daisu's room/i })).toBeVisible();
  await page.getByRole("dialog", { name: /daisu's room/i }).getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "Open Daisu" })).toBeVisible();

  // nothing leaves before the batch window or the tab going away
  expect(batches).toHaveLength(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => batches.length).toBe(1);

  const [batch] = batches;
  expect(batch.sid).toMatch(/^[a-z0-9]+$/);
  expect(batch.events.map((e) => [e.name, e.params.via, e.params.from ?? null])).toEqual([
    ["daisu_open", "bubble", null],
    ["daisu_room", "card_visit", "popup"],
    ["daisu_close", "close", "room"],
  ]);
  expect(batch.events.every((e) => e.path === "/" && e.ago >= 0)).toBe(true);
});
