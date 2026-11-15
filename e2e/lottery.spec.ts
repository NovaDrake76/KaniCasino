import { test, expect, Page, Route } from "@playwright/test";
import { mockApi, mockSession } from "./mocks";

const SEED = "abc";
const SEED_HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

const state = (drawInMs = 2 * 3600 * 1000) => {
  const now = Date.now();
  return {
    serverTime: new Date(now).toISOString(),
    rules: { pool: 20, pick: 3, price: 100, cap: 50, drawHourUtc: 20, salesCloseMs: 60000, prizes: { 1: 100, 2: 300 }, jackpotBase: 25000, jackpotShare: 25, combinations: 1140 },
    draw: {
      number: 2,
      status: "open",
      drawAt: new Date(now + drawInMs).toISOString(),
      salesCloseAt: new Date(now + drawInMs - 60000).toISOString(),
      jackpot: 25175,
      tickets: 4,
      carried: 1,
      seedHash: "f".repeat(64),
    },
    last: {
      number: 1,
      drawAt: new Date(now - 22 * 3600 * 1000).toISOString(),
      settledAt: new Date(now - 22 * 3600 * 1000).toISOString(),
      numbers: [5, 7, 19],
      jackpot: 25075,
      jackpotEach: 0,
      tickets: 3,
      carried: 0,
      winners: { m1: 2, m2: 1, m3: 0 },
      jackpotWinners: [],
      seedHash: SEED_HASH,
      serverSeed: SEED,
    },
    me: {
      tickets: [{ numbers: [1, 2, 3] }],
      count: 1,
      left: 49,
      last: { number: 1, tickets: [{ numbers: [5, 7, 8], matches: 2, prize: 300 }], won: 300 },
    },
  };
};

// the page itself is served from /lottery too, and on ci the api shares its origin, so only a fetch is answered
const onApi = (page: Page, glob: string, json: (body: { picks: number[][] }) => unknown) =>
  page.route(glob, (route) =>
    route.request().resourceType() === "document" ? route.fallback() : route.fulfill({ json: json(route.request().postDataJSON()) })
  );

// a socket.io server over long polling; a signed-in page reconnects once its session loads, so each connection gets everything emitted so far
async function fakeSocket(page: Page) {
  const headers = { "Access-Control-Allow-Origin": "*" };
  const queue: string[] = [];
  const emitted: string[] = [];
  let sid = 0;
  let joined = false;
  let waiting: Route | null = null;
  const flush = () => {
    if (!waiting || !queue.length) return;
    const route = waiting;
    waiting = null;
    route.fulfill({ body: queue.splice(0).join("\x1e"), contentType: "text/plain", headers }).catch(() => undefined);
  };
  await page.route("**/socket.io/**", (route) => {
    const request = route.request();
    const from = Number(/[?&]sid=s(\d+)/.exec(request.url())?.[1] ?? 0);
    if (!from) {
      sid += 1;
      joined = false;
      queue.length = 0;
      waiting = null;
      const open = { sid: `s${sid}`, upgrades: [], pingInterval: 25000, pingTimeout: 60000, maxPayload: 1000000 };
      return route.fulfill({ body: `0${JSON.stringify(open)}`, contentType: "text/plain", headers });
    }
    // a connection the page has already dropped
    if (from !== sid) return route.fulfill({ status: 400, body: "", headers });
    if (request.method() === "POST") {
      if ((request.postData() || "").startsWith("40")) {
        joined = true;
        queue.push('40{"sid":"n1"}', ...emitted);
      }
      setTimeout(flush, 10);
      return route.fulfill({ body: "ok", contentType: "text/plain", headers });
    }
    waiting = route;
    flush();
  });
  return (event: string, payload: unknown) => {
    const packet = `42${JSON.stringify([event, payload])}`;
    emitted.push(packet);
    if (!joined) return;
    queue.push(packet);
    flush();
  };
}

// the drum's pixels, to tell a moving drum from a still one
const drumPixels = (page: Page) => page.getByTestId("drum").evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());

// a signed-in player has watched draw #1 already unless a test says otherwise, so the page does not replay it on arrival
async function open(page: Page, { drawInMs, seen = true }: { drawInMs?: number; seen?: boolean } = {}) {
  await page.addInitScript(() => localStorage.setItem("kani.onboardingSeen", "1"));
  if (seen) await page.addInitScript(() => localStorage.setItem("lottery.seen.player1", "1"));
  // registered first so every mock below wins over it; anything left unmocked is aborted rather than let out
  await page.route("**/*", (route) => {
    const url = route.request().url();
    const ours = url.includes("localhost:4173") || url.startsWith("data:") || url.startsWith("blob:");
    return ours ? route.fallback() : route.abort();
  });
  await mockApi(page);
  await mockSession(page);
  const bought: { picks: number[][] }[] = [];
  await onApi(page, "**/lottery", () => state(drawInMs));
  await onApi(page, "**/lottery/draws**", () => ({ page: 1, pages: 1, draws: [state().last] }));
  await onApi(page, "**/lottery/draws/1/tickets", () => ({
    number: 1,
    status: "settled",
    numbers: [5, 7, 19],
    tickets: [{ numbers: [5, 7, 8], matches: 2, prize: 300 }],
    won: 300,
  }));
  await onApi(page, "**/lottery/tickets", (body) => {
    bought.push(body);
    const n = body.picks.length;
    return {
      tickets: body.picks.map((numbers) => ({ numbers })),
      balance: 5000 - 100 * n,
      draw: { number: 2, jackpot: 25175 + 25 * n, tickets: 4 + n },
      me: { count: 1 + n, left: 49 - n },
    };
  });
  return bought;
}

test("the lottery opens from the games menu", async ({ page }) => {
  await open(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Games" }).click();
  const link = page.getByRole("link", { name: "Daily Lottery", exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/lottery$/);
  await expect(page.getByTestId("jackpot")).toHaveText(/K₽\s25,175/);
  await expect(page.getByTestId("clock-label")).toHaveText("Draw #2 in");
});

test("the stage turns the drum, keeps the tray empty and shows the pick beside it", async ({ page }) => {
  await open(page);
  await page.goto("/lottery");
  const drum = page.getByRole("img", { name: "Lottery drum holding the numbered balls" });
  await expect(drum).toBeVisible();
  const painted = await drum.evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    return !!ctx && ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data[3] > 0;
  });
  expect(painted).toBe(true);
  const before = await drumPixels(page);
  await expect.poll(() => drumPixels(page)).not.toBe(before);

  await expect(page.getByTestId("tray-slot")).toHaveCount(3);
  await expect(page.getByTestId("tray").getByTestId("ball")).toHaveCount(0);
  await expect(page.getByTestId("rolling")).toHaveText(/Rolling for 1 day/i);
  await expect(page.getByTestId("stage-status")).toHaveText("4 tickets sold");
  await expect(page.getByTestId("prizes")).toContainText("Jackpot");
  await expect(page.getByTestId("prizes")).not.toContainText("1 in");
  await expect(page.getByText(/Sales close a minute before/)).toHaveCount(0);

  const mine = page.getByTestId("your-pick").getByTestId("ball");
  await expect(mine).toHaveText(["?", "?", "?"]);
  const grid = page.getByTestId("number-grid");
  for (const n of ["19", "3", "7"]) await grid.getByRole("button", { name: n, exact: true }).click();
  await expect(mine).toHaveText(["3", "7", "19"]);
});

test("the drum holds still for a player who asked for less motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await page.goto("/lottery");
  await expect(page.getByTestId("drum")).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const first = await drumPixels(page);
  await page.waitForTimeout(400);
  expect(await drumPixels(page)).toBe(first);
});

test("in the last minute the clock keeps running and sales close", async ({ page }) => {
  await open(page, { drawInMs: 30 * 1000 });
  await page.goto("/lottery");
  await expect(page.getByTestId("clock-label")).toHaveText("Draw #2 in");
  await expect(page.getByTestId("countdown")).toHaveText(/^00:[0-3]\d$/);
  await expect(page.getByTestId("stage-status")).toHaveText("Sales closed, drawing soon");
  await expect(page.getByRole("button", { name: "Sales are closed for this draw" })).toBeDisabled();
});

test("a live draw drops its numbers into the tray, ringing the player's own", async ({ page }) => {
  await open(page);
  const emit = await fakeSocket(page);
  await page.goto("/lottery");
  await expect(page.getByTestId("held")).toBeVisible();
  emit("lottery:drawn", { number: 2, numbers: [2, 9, 14], jackpot: 25175, jackpotEach: 0, winners: { m1: 0, m2: 0, m3: 0 }, jackpotWinners: [], next: null });
  await expect(page.getByTestId("clock-label")).toHaveText("Drawing #2");
  const balls = page.getByTestId("tray").getByTestId("ball");
  await expect(balls).toHaveText(["2", "9", "14"], { timeout: 8000 });
  await expect(balls.nth(0)).toHaveAttribute("data-tone", "hit");
  await expect(balls.nth(1)).toHaveAttribute("data-tone", "drawn");
  await expect(balls.nth(2)).toHaveAttribute("data-tone", "drawn");
});

test("a slip is picked by hand and by quick pick, then bought in one request", async ({ page }) => {
  const bought = await open(page);
  await page.goto("/lottery");
  const grid = page.getByTestId("number-grid");
  for (const n of ["19", "3", "7"]) await grid.getByRole("button", { name: n, exact: true }).click();
  await expect(page.getByTestId("pick-hint")).toHaveText("3 of 3");
  await page.getByRole("button", { name: "Add to slip" }).click();
  await page.getByRole("button", { name: "Quick pick 5" }).click();
  await expect(page.getByTestId("slip-row")).toHaveCount(6);

  await page.getByRole("button", { name: /^Buy 6 tickets for K₽\s600$/ }).click();
  await expect(page.getByTestId("slip-row")).toHaveCount(0);
  expect(bought).toHaveLength(1);
  expect(bought[0].picks).toHaveLength(6);
  expect(bought[0].picks[0]).toEqual([3, 7, 19]);
  await expect(page.getByTestId("my-ticket")).toHaveCount(7);
  await expect(page.getByTestId("jackpot")).toHaveText(/K₽\s25,325/);
});

test("the last draw shows its numbers, the rollover and what the player's tickets won", async ({ page }) => {
  await open(page);
  await page.goto("/lottery");
  const last = page.getByTestId("last-draw");
  await expect(last.getByTestId("jackpot-line")).toHaveText("Nobody matched 3. The jackpot rolled over.");
  await expect(last.getByTestId("ball").first()).toHaveText("5");
  await expect(last.getByTestId("result-row")).toHaveCount(1);
  await expect(last.getByTestId("last-total")).toHaveText(/You won K₽\s300/);

  await page.getByTestId("draw-history").getByRole("button", { name: /#1/ }).click();
  await page.getByRole("button", { name: "Check the numbers" }).click();
  await expect(page.getByTestId("check-result")).toHaveText("Checked in your browser: the seed matches its hash and draws 5, 7, 19.");
});

// the same budget the other boards are held to: a 1366x768 laptop with the browser's chrome taken off
test("the jackpot, the drum, the tray, the clock and the pick panel fit a short laptop without scrolling", async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1366, height: 678 });
  await page.goto("/lottery");
  const shell = page.locator("div.rounded-lg.border.border-line").first();
  await expect(page.getByTestId("jackpot")).toHaveText(/K₽/);
  // measured with the signed-in panel, repeat chip and all, which is its tallest
  await expect(page.getByRole("button", { name: "Repeat last draw (1)" })).toBeVisible();
  const box = (await shell.boundingBox())!;
  expect(Math.max(0, Math.round(box.y + box.height - 678))).toBe(0);
  for (const id of ["jackpot", "drum", "tray", "countdown", "your-pick", "prizes"]) {
    const part = (await page.getByTestId(id).boundingBox())!;
    expect(part.y, id).toBeGreaterThanOrEqual(box.y);
    expect(Math.round(part.y + part.height), id).toBeLessThanOrEqual(Math.round(box.y + box.height));
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the page fits a phone without pushing it sideways", async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/lottery");
  await expect(page.getByTestId("jackpot")).toHaveText(/K₽/);
  await expect(page.getByTestId("history-row")).toHaveCount(1);
  const jackpot = (await page.getByTestId("jackpot").boundingBox())!;
  expect(jackpot.y + jackpot.height).toBeLessThanOrEqual(740);
  const drum = (await page.getByTestId("drum").boundingBox())!;
  expect(drum.x).toBeGreaterThanOrEqual(0);
  expect(drum.x + drum.width).toBeLessThanOrEqual(360);
  expect(drum.width).toBeGreaterThanOrEqual(240);
  const tray = (await page.getByTestId("tray").boundingBox())!;
  expect(tray.x + tray.width).toBeLessThanOrEqual(360);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("a player who missed the draw sees it played back once, with the last draw card held back until the balls are in", async ({ page }) => {
  await open(page, { seen: false });
  await page.goto("/lottery");
  const status = page.getByTestId("stage-status");
  await expect(status).toHaveText("Replay of draw #1");
  await expect(page.getByTestId("clock-label")).toHaveText("Draw #2 in");
  await expect(page.getByTestId("jackpot")).toHaveText(/K₽\s25,175/);
  const last = page.getByTestId("last-draw");
  await expect(last.getByTestId("last-watching")).toHaveText("Watching the draw...");
  await expect(last.getByTestId("jackpot-line")).toHaveCount(0);
  await expect(last.getByRole("button", { name: "Watch the draw" })).toBeDisabled();
  const newest = page.getByTestId("history-row").first().getByTestId("ball");
  await expect(newest).toHaveText(["?", "?", "?"]);

  const balls = page.getByTestId("tray").getByTestId("ball");
  await expect(balls).toHaveText(["5", "7", "19"], { timeout: 8000 });
  await expect(newest).toHaveText(["5", "7", "19"]);
  await expect(balls.nth(0)).toHaveAttribute("data-tone", "hit");
  await expect(balls.nth(2)).toHaveAttribute("data-tone", "drawn");
  await expect(last.getByTestId("jackpot-line")).toHaveText("Nobody matched 3. The jackpot rolled over.");
  await expect(status).toHaveText(/^Your tickets won K₽\s300$/, { timeout: 5000 });
  expect(await page.evaluate(() => localStorage.getItem("lottery.seen.player1"))).toBe("1");

  await page.reload();
  await expect(page.getByTestId("my-ticket")).toHaveCount(1);
  await expect(status).toHaveText("4 tickets sold");
  await expect(page.getByTestId("tray").getByTestId("ball")).toHaveCount(0);
});

test("anyone can watch the last draw again from its card", async ({ page }) => {
  await open(page);
  await page.goto("/lottery");
  await expect(page.getByTestId("my-ticket")).toHaveCount(1);
  const last = page.getByTestId("last-draw");
  const watch = last.getByRole("button", { name: "Watch the draw" });
  await watch.click();
  await expect(page.getByTestId("stage-status")).toHaveText("Replay of draw #1");
  await expect(watch).toBeDisabled();
  await expect(last.getByTestId("jackpot-line")).toBeVisible();
  await expect(page.getByTestId("tray").getByTestId("ball")).toHaveText(["5", "7", "19"], { timeout: 8000 });
  await expect(page.getByTestId("stage-status")).toHaveText(/^Your tickets won K₽\s300$/, { timeout: 5000 });
});

test("the last draw's tickets go back on the slip from one chip", async ({ page }) => {
  const bought = await open(page);
  await page.goto("/lottery");
  const repeat = page.getByRole("button", { name: "Repeat last draw (1)" });
  await repeat.click();
  await repeat.click();
  await expect(page.getByTestId("slip-row")).toHaveCount(2);
  await page.getByRole("button", { name: /^Buy 2 tickets for K₽\s200$/ }).click();
  await expect(page.getByTestId("slip-row")).toHaveCount(0);
  expect(bought).toHaveLength(1);
  expect(bought[0].picks).toEqual([[5, 7, 8], [5, 7, 8]]);
});
