import { test, expect, Page, Locator } from "@playwright/test";
import { mockApi, mockSession } from "./mocks";

const pocket = {
  ticket: "pocket",
  price: 10,
  quantity: 1,
  tickets: [
    {
      symbol: "coins",
      multiplier: 5,
      payout: 50,
      cells: ["coins", "star", "chest", "clover", "coins", "star", "gem", "clover", "coins"],
      line: [0, 4, 8],
      winningCells: [0, 4, 8],
      rollId: "R123456789",
    },
  ],
  totalPayout: 50,
  balanceAfterCharge: 4990,
  balance: 5040,
};

const nine = {
  ticket: "nine",
  price: 100,
  quantity: 1,
  tickets: [
    {
      lucky: ["nine", "snowflake"],
      multiplier: 2,
      payout: 1000,
      spots: [
        { symbol: "frog", prize: 100 },
        { symbol: "star", prize: 200 },
        { symbol: "snowflake", prize: 500 },
        { symbol: "heart", prize: 100 },
        { symbol: "gem", prize: 1000 },
        { symbol: "flame", prize: 200 },
        { symbol: "crown", prize: 2500 },
        { symbol: "clover", prize: 100 },
      ],
      winningSpots: [2],
      rollId: "R977531000",
    },
  ],
  totalPayout: 1000,
  balanceAfterCharge: 4900,
  balance: 5900,
};

const board = [0, 500, 0, 2500, 1000, 0, 0, 0, 500];
const treasureGame = { id: "SC000033918", ticket: "treasure", price: 1000, status: "active", picks: [], left: 3, board: null, payout: 0, rollId: null };
const treasure = { ticket: "treasure", price: 1000, quantity: 1, game: treasureGame, balanceAfterCharge: 4000, balance: 4000 };

async function open(page: Page, baseURL: string | undefined, purchase: unknown = pocket) {
  await page.addInitScript(() => localStorage.setItem("kani.onboardingSeen", "1"));
  const origin = new URL(baseURL || "http://localhost:4173").origin;
  // registered first so every mock below wins over it; anything left unmocked is aborted rather than let out to whatever
  // listens on the api port, whose 401 to the test token would end the session mid-test
  await page.route("**/*", (route) => {
    const url = route.request().url();
    const ours = url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:");
    return ours ? route.fallback() : route.abort();
  });
  await mockApi(page);
  await mockSession(page);
  const bought: unknown[] = [];
  const picks: number[] = [];
  await page.route("**/games/scratch", (route) => {
    bought.push(route.request().postDataJSON());
    return route.fulfill({ json: purchase });
  });
  await page.route("**/games/scratch/active", (route) => route.fulfill({ json: { game: null } }));
  await page.route("**/games/scratch/pick", (route) => {
    const { cell } = route.request().postDataJSON() as { cell: number };
    picks.push(cell);
    const settled = picks.length === 3;
    const payout = picks.reduce((s, c) => s + board[c], 0);
    return route.fulfill({
      json: {
        ...treasureGame,
        status: settled ? "settled" : "active",
        picks: picks.map((c) => ({ cell: c, find: board[c] })),
        left: 3 - picks.length,
        board: settled ? board : null,
        payout: settled ? payout : 0,
        rollId: settled ? "R555033918" : null,
        cell,
        find: board[cell],
        balance: settled ? 4000 + payout : undefined,
      },
    });
  });
  return { bought, picks };
}

// rows a brush and a half apart, each a fresh press, the way a hand covers a coating; `brush` is the radius over the width
async function rub(page: Page, target: Locator, brush: number, passes = 2) {
  const box = (await target.boundingBox())!;
  const gap = 1.5 * brush * box.width;
  for (let pass = 0; pass < passes; pass++) {
    for (let y = gap / 2; y < box.height; y += gap) {
      await page.mouse.move(box.x + box.width * 0.03, box.y + y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.97, box.y + y, { steps: 10 });
      await page.mouse.up();
    }
  }
}

const SPOT_BRUSH = 0.16;

// a treasure spot is only spent by rubbing in one press, so this keeps the button down and zig-zags over the rows, twice
async function rubSpot(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  const gap = 1.5 * SPOT_BRUSH * box.width;
  const [left, right] = [box.x + box.width * 0.03, box.x + box.width * 0.97];
  await page.mouse.move(left, box.y + gap / 2);
  await page.mouse.down();
  for (let pass = 0; pass < 2; pass++) {
    let forward = true;
    for (let y = gap / 2; y < box.height; y += gap) {
      await page.mouse.move(forward ? left : right, box.y + y, { steps: 2 });
      await page.mouse.move(forward ? right : left, box.y + y, { steps: 10 });
      forward = !forward;
    }
  }
  await page.mouse.up();
}

// across the middle and back in one press: past the commit point, nowhere near cleared; `lift` false keeps the button down
async function commitSpot(page: Page, target: Locator, lift = true) {
  const box = (await target.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.03, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.97, y, { steps: 10 });
  await page.mouse.move(box.x + box.width * 0.03, y, { steps: 10 });
  if (lift) await page.mouse.up();
}

// how much foil is left at a point of a coating, 0 to 255, read off its canvas
const foilAt = (target: Locator, fx: number, fy: number) =>
  target.evaluate((el, [x, y]) => {
    const canvas = el as HTMLCanvasElement;
    return canvas.getContext("2d")!.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data[3];
  }, [fx, fy]);

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// a box against the page rather than the viewport, so a scroll the browser makes to reach a click is not counted as a move
const pageBox = (target: Locator) =>
  target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) };
  });

// the ticket's art and its name font are in before it is measured, or the box would still be growing; and on a phone the
// buy button sits under the board, so buying scrolls back up to the ticket, which has to stop before a spot is rubbed
const settled = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForFunction(() => [...document.querySelectorAll("[data-testid=scratch-ticket] img")].every((img) => (img as HTMLImageElement).complete));
  let last = -1;
  await expect
    .poll(
      async () => {
        const y = await page.evaluate(() => window.scrollY);
        const still = y === last;
        last = y;
        return still;
      },
      { intervals: [150] }
    )
    .toBe(true);
};

const shellOf = (page: Page) => page.locator("div.rounded-lg.border.border-line").first();

test("the catalogue opens from the games menu", async ({ page, baseURL }) => {
  await open(page, baseURL);
  await page.goto("/");
  await page.getByRole("button", { name: "Games" }).click();
  const link = page.getByRole("link", { name: "Scratch Cards", exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/scratch$/);
  const rack = page.getByTestId("scratch-catalogue");
  await expect(rack.getByRole("button")).toHaveCount(3);
  await expect(page.getByTestId("ticket-card-pocket")).toHaveAttribute("aria-pressed", "true");
});

test("selecting each ticket fills the panel with its rule, key and price", async ({ page, baseURL }) => {
  await open(page, baseURL);
  await page.goto("/scratch");
  const details = page.getByTestId("ticket-details");

  await page.getByTestId("ticket-card-nine").click();
  await expect(page.getByTestId("ticket-card-nine")).toHaveAttribute("aria-pressed", "true");
  await expect(details).toContainText("Perfect Nine");
  await expect(details).toContainText("Match a lucky symbol to win its prize.");
  await expect(details).toContainText("Multipliers");
  await expect(page.getByRole("button", { name: /^Buy 1 for/ })).toHaveText(/Buy 1 for K₽\s100$/);

  await page.getByTestId("ticket-card-treasure").click();
  await expect(details).toContainText("Borrowed Treasure");
  await expect(details).toContainText("Scratch 3 only.");
  await expect(page.getByRole("button", { name: "10", exact: true })).toHaveCount(0);

  await page.getByTestId("ticket-card-pocket").click();
  await expect(details).toContainText("Match 3 in a line to win.");
  await page.getByRole("button", { name: "3", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Buy 3 for/ })).toHaveText(/Buy 3 for K₽\s30$/);
});

test("a pocket ticket scratched by hand: a click clears nothing, two passes reveal it", async ({ page, baseURL }) => {
  const { bought } = await open(page, baseURL);
  await page.goto("/scratch");
  await page.getByRole("button", { name: /^Buy 1 for/ }).click();
  await expect(page.getByRole("button", { name: "Reveal all" })).toBeVisible();
  expect(bought).toEqual([{ ticket: "pocket", quantity: 1 }]);
  const result = page.getByTestId("scratch-result");
  await expect(result).toHaveText("");
  await expect(page.getByRole("button", { name: "Buy again" })).toHaveCount(0);
  await settled(page);
  const ticket = page.getByTestId("scratch-ticket");
  const before = [await pageBox(ticket), await pageBox(shellOf(page))];

  const coating = page.getByTestId("scratch-coating");
  const box = (await coating.boundingBox())!;
  for (let k = 0; k < 5; k++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  await expect(result).toHaveText("");

  await rub(page, coating, 0.075, 1);
  await expect(result).toHaveText("");
  await rub(page, coating, 0.075, 1);
  await expect(result).toHaveText(/^Three coin stacks in a line\. Won K₽\s50\.$/);
  await expect(page.locator("[data-testid=scratch-cell][data-mark=win]")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Buy again" })).toBeVisible();
  // the result line and the buttons had their row from the start, so the ticket and the shell are where they were
  expect([await pageBox(ticket), await pageBox(shellOf(page))]).toEqual(before);
  await page.getByRole("button", { name: "Back to the catalogue" }).click();
  await expect(page.getByTestId("scratch-catalogue")).toBeVisible();
});

test("a treasure ticket takes three spots and refuses a fourth", async ({ page, baseURL }) => {
  const { picks } = await open(page, baseURL, treasure);
  await page.goto("/scratch");
  await page.getByTestId("ticket-card-treasure").click();
  await page.getByRole("button", { name: /^Buy 1 for/ }).click();
  const ticket = page.getByTestId("scratch-ticket");
  await expect(ticket).toContainText("Scratch 3 only. 3 left.");
  await expect(page.getByTestId("scratch-result")).toHaveText("");
  await settled(page);
  const before = [await pageBox(ticket), await pageBox(shellOf(page))];
  const spots = page.getByTestId("spot-coating");
  const spot = (i: number) => page.getByTestId("treasure-spot").nth(i);
  const pips = page.getByTestId("ticket-pips").locator("[data-mark]");

  await rubSpot(page, spots.nth(3));
  await expect(spot(3)).toHaveAttribute("data-mark", "open");
  await expect(spot(3)).toContainText("2,500");
  await expect(ticket).toContainText("Scratch 3 only. 2 left.");
  await expect(pips.nth(0)).toHaveAttribute("data-mark", "won");

  await rubSpot(page, spots.nth(1));
  await expect(spot(1)).toHaveAttribute("data-mark", "open");
  await expect(ticket).toContainText("Scratch 3 only. 1 left.");
  await expect(pips.nth(1)).toHaveAttribute("data-mark", "found");

  // the third spot is spent once rubbed past its commit point, so a fourth cannot be started while it is still covered
  await commitSpot(page, spots.nth(6));
  await expect(ticket).toContainText("Scratch 3 only. 0 left.");
  await rubSpot(page, spots.nth(0));
  expect(picks).toEqual([3, 1, 6]);
  await expect(spot(0)).toHaveAttribute("data-mark", "covered");

  await rubSpot(page, spots.nth(6));
  await expect(page.getByTestId("scratch-result")).toHaveText(/^Won K₽\s3,000\.$/);
  await expect(page.locator("[data-testid=treasure-spot][data-mark=kept]")).toHaveCount(3);
  await expect(page.locator("[data-testid=treasure-spot][data-mark=missed]")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Back to the catalogue" })).toBeVisible();
  expect(picks).toEqual([3, 1, 6]);
  expect([await pageBox(ticket), await pageBox(shellOf(page))]).toEqual(before);
});

test("a tap, a flick or one swipe never spends a treasure spot, and an early lift puts the foil back", async ({ page, baseURL }) => {
  const { picks } = await open(page, baseURL, treasure);
  await page.goto("/scratch");
  await page.getByTestId("ticket-card-treasure").click();
  await page.getByRole("button", { name: /^Buy 1 for/ }).click();
  const ticket = page.getByTestId("scratch-ticket");
  await expect(ticket).toContainText("Scratch 3 only. 3 left.");
  const coating = page.getByTestId("spot-coating").nth(4);
  const box = (await coating.boundingBox())!;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];

  for (let k = 0; k < 3; k++) await page.mouse.click(cx, cy);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + box.width * 0.35, cy - box.height * 0.1, { steps: 4 });
  await page.mouse.up();
  // a scroll that starts on the spot: straight down and far past it
  await page.mouse.move(cx, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(cx, box.y + box.height * 4, { steps: 30 });
  await page.mouse.up();
  await page.mouse.move(box.x + 3, cy);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 3, cy, { steps: 12 });
  await page.mouse.up();

  await page.waitForTimeout(400);
  expect(picks).toEqual([]);
  await expect(ticket).toContainText("Scratch 3 only. 3 left.");
  await expect(page.getByTestId("treasure-spot").nth(4)).toHaveAttribute("data-mark", "covered");
  expect(await foilAt(coating, 0.5, 0.5)).toBe(255);

  // held down, the swipe has worn the foil; let go, and it grows back
  await page.mouse.move(box.x + 3, cy);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 3, cy, { steps: 12 });
  expect(await foilAt(coating, 0.5, 0.5)).toBeLessThan(255);
  await page.mouse.up();
  await expect.poll(() => foilAt(coating, 0.5, 0.5)).toBe(255);
  expect(picks).toEqual([]);

  await rubSpot(page, coating);
  await expect(page.getByTestId("treasure-spot").nth(4)).toHaveAttribute("data-mark", "open");
  expect(picks).toEqual([4]);
});

test("the catalogue leads with each ticket's top prize, then its price and rule, and leaves the odds to the game info", async ({ page, baseURL }) => {
  await open(page, baseURL);
  await page.goto("/scratch");
  const card = page.getByTestId("ticket-card-treasure");
  await expect(card.getByTestId("card-top")).toHaveText(/K₽\s300,000/);
  await expect(card.getByTestId("card-price")).toHaveText(/K₽\s1,000/);
  await expect(card).toContainText("Scratch 3 only.");
  await expect(page.getByTestId("scratch-catalogue")).not.toContainText("1 in");
  const top = await card.getByTestId("card-top").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const price = await card.getByTestId("card-price").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(top).toBeGreaterThan(price);
});

// picking a ticket only changes what the panel's box says: the shell, the rack, its cards, the buy button and the strip
// under the page keep their boxes, whichever of the three is picked
for (const [width, height] of [
  [1440, 900],
  [1366, 678],
  [360, 740],
] as const) {
  test(`picking each ticket in the rack moves nothing at ${width}x${height}`, async ({ page, baseURL }) => {
    await open(page, baseURL);
    await page.setViewportSize({ width, height });
    await page.goto("/scratch");
    await expect(page.getByTestId("scratch-catalogue")).toBeVisible();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const parts = [
      shellOf(page),
      page.getByRole("button", { name: /^Buy \d+ for/ }),
      page.getByTestId("scratch-catalogue"),
      ...["pocket", "nine", "treasure"].map((id) => page.getByTestId(`ticket-card-${id}`)),
      page.getByTestId("ticket-details"),
      page.getByTestId("game-details"),
    ];
    const boxes = async () => Promise.all(parts.map(pageBox));
    const seen = [];
    for (const id of ["nine", "treasure", "pocket"]) {
      await page.getByTestId(`ticket-card-${id}`).click();
      await expect(page.getByTestId(`ticket-card-${id}`)).toHaveAttribute("aria-pressed", "true");
      seen.push(await boxes());
    }
    expect(seen[1]).toEqual(seen[0]);
    expect(seen[2]).toEqual(seen[0]);
  });
}

const tenPockets = {
  ...pocket,
  quantity: 10,
  tickets: Array.from({ length: 10 }, (_, i) =>
    i % 3 === 1
      ? pocket.tickets[0]
      : { symbol: null, multiplier: 0, payout: 0, cells: ["star", "clover", "coins", "gem", "chest", "star", "clover", "crown", "coins"], line: null, winningCells: [], rollId: `R12345678${i}` }
  ),
  totalPayout: 150,
  balanceAfterCharge: 4900,
  balance: 5050,
};

test("a stack of ten counts itself in the panel beside the ticket, and next to the ticket on a phone", async ({ page, baseURL }) => {
  await open(page, baseURL, tenPockets);
  await page.setViewportSize({ width: 1366, height: 678 });
  await page.goto("/scratch");
  await page.getByRole("button", { name: "10", exact: true }).click();
  await page.getByRole("button", { name: /^Buy 10 for/ }).click();
  for (let k = 0; k < 2; k++) {
    await page.getByRole("button", { name: "Reveal all" }).click();
    await page.getByRole("button", { name: "Next ticket" }).click();
  }
  const pips = page.getByTestId("ticket-pips").locator("[data-mark]");
  await expect(pips).toHaveCount(10);
  await expect(pips.nth(0)).toHaveAttribute("data-mark", "lost");
  await expect(pips.nth(1)).toHaveAttribute("data-mark", "won");
  await expect(pips.nth(2)).toHaveAttribute("data-current", "true");
  await expect(page.getByTestId("ticket-progress")).toContainText(/Won so far\s*K₽\s50/);
  await expect(page.getByTestId("stack-progress")).toBeHidden();
  const shell = page.locator("div.rounded-lg.border.border-line").first();
  const box = (await shell.boundingBox())!;
  expect(Math.max(0, Math.round(box.y + box.height - 678))).toBe(0);

  await page.setViewportSize({ width: 360, height: 740 });
  await expect(page.getByTestId("stack-progress")).toBeVisible();
  await expect(page.getByTestId("stack-progress")).toContainText("Ticket 3 of 10");
  expect(await sideways(page)).toBeLessThanOrEqual(1);
});

// the same budget the other boards are held to: a 1366x768 laptop with the browser's chrome taken off
for (const [name, purchase, card] of [
  ["pocket", pocket, "ticket-card-pocket"],
  ["nine", nine, "ticket-card-nine"],
  ["treasure", treasure, "ticket-card-treasure"],
] as const) {
  test(`a ${name} ticket fits a short laptop screen without scrolling, in play and finished`, async ({ page, baseURL }) => {
    await open(page, baseURL, purchase);
    await page.setViewportSize({ width: 1366, height: 678 });
    await page.goto("/scratch");
    const shell = page.locator("div.rounded-lg.border.border-line").first();
    const overflow = async () => {
      const box = (await shell.boundingBox())!;
      return Math.max(0, Math.round(box.y + box.height - 678));
    };
    await expect(page.getByTestId("scratch-catalogue")).toBeVisible();
    expect(await overflow()).toBe(0);
    await page.getByTestId(card).click();
    await page.getByRole("button", { name: /^Buy 1 for/ }).click();
    const ticket = page.getByTestId("scratch-ticket");
    await expect(ticket).toBeVisible();
    expect(await overflow()).toBe(0);
    expect(await sideways(page)).toBeLessThanOrEqual(1);
    await settled(page);
    const before = await pageBox(ticket);

    if (name === "treasure") for (const i of [3, 1, 6]) await rubSpot(page, page.getByTestId("spot-coating").nth(i));
    else await page.getByRole("button", { name: "Reveal all" }).click();
    await expect(page.getByRole("button", { name: "Buy again" })).toBeVisible();
    expect(await overflow()).toBe(0);
    expect(await pageBox(ticket)).toEqual(before);
  });

  test(`a ${name} ticket fits a phone without pushing the page sideways, and finishing it moves nothing`, async ({ page, baseURL }) => {
    await open(page, baseURL, purchase);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/scratch");
    await expect(page.getByTestId("scratch-catalogue")).toBeVisible();
    expect(await sideways(page)).toBeLessThanOrEqual(1);
    await page.getByTestId(card).click();
    await page.getByRole("button", { name: /^Buy 1 for/ }).click();
    const ticket = page.getByTestId("scratch-ticket");
    await expect(ticket).toBeVisible();
    const box = (await ticket.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(740);
    expect(await sideways(page)).toBeLessThanOrEqual(1);

    // under the ticket the panel and the page go on, and finishing the ticket moves none of them
    await settled(page);
    const parts = [ticket, page.getByTestId("ticket-progress"), page.getByTestId("game-details")];
    const before = await Promise.all(parts.map(pageBox));
    if (name === "treasure") for (const i of [3, 1, 6]) await rubSpot(page, page.getByTestId("spot-coating").nth(i));
    else await page.getByRole("button", { name: "Reveal all" }).click();
    await expect(page.getByRole("button", { name: "Buy again" })).toBeVisible();
    expect(await Promise.all(parts.map(pageBox))).toEqual(before);
  });
}
