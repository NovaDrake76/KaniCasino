import { test, expect, Page } from "@playwright/test";
import { mockApi, mockSession } from "./mocks";

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
  await page.route("**/leaderboard**", (route) =>
    route.fulfill({
      json: {
        boardId: "b1",
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        serverTime: new Date().toISOString(),
        paidPlaces: 10,
        pool: 21700,
        prizes: [10000, 5000, 2500, 1200, 900, 700, 500, 400, 300, 200],
        standings: [],
        me: null,
      },
    })
  );
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
    { text: "Play Scratch Cards", url: /\/scratch/ },
    { text: "Play Daily Lottery", url: /\/lottery/ },
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

test("the recommended section renders above the games and category listings", async ({ page }) => {
  await page.route("**/cases/most-opened**", (route) =>
    route.fulfill({ json: [{ _id: "case9", title: "Hot Case", image: IMG, price: 250, opens: 42 }] })
  );
  await page.goto("/");

  await expect(page.getByText("Recommended Cases")).toBeVisible();
  await expect(page.getByText("Hot Case")).toBeVisible();

  const topOf = async (text: string | RegExp) => {
    const el = page.getByText(text).first();
    if ((await el.count()) === 0) return null;
    const box = await el.boundingBox();
    return box ? box.y : null;
  };

  const ys = [
    await topOf("Recommended Cases"),
    await topOf("Our Games"),
    await topOf(/^DAILY LEADERBOARD$/),
    await topOf("Event Cases"),
  ];
  expect(ys.every((y) => y !== null)).toBe(true);
  expect([...ys]).toEqual([...ys].sort((a, b) => (a as number) - (b as number)));

  // the discord block renders only when VITE_DISCORD_INVITE is set, which ci does not.
  // looked up by its button, since a hero slide can also say "join our discord". it is the
  // leaderboard's aside, so it sits after the games and before the case shelves.
  const discord = await topOf("Join the KaniCasino server");
  if (discord !== null) {
    expect(discord).toBeGreaterThan(ys[1] as number);
    expect(discord).toBeLessThan(ys[3] as number);
  }
});

test("the recommended section is absent when nothing has been opened and nothing is pinned", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Recommended Cases")).toHaveCount(0);
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

test("the category bar carries the recommended shelf only when it exists", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Case categories" });
  await expect(bar.getByRole("button", { name: "Event" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Recommended" })).toHaveCount(0);

  await page.route("**/cases/most-opened**", (route) =>
    route.fulfill({ json: [{ _id: "case9", title: "Hot Case", image: IMG, price: 250, opens: 42 }] })
  );
  await page.goto("/");
  await expect(bar.getByRole("button", { name: "Recommended" })).toBeVisible();
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

// Three separate bugs have shipped from picking a z-index inline: the category bar over the
// login form, the leaderboard podium over the category bar, and each fix breaking the next
// thing. The layer order now lives in tailwind.config.js, and these two tests are what stops
// it drifting: they assert what is actually on top at a pixel, which is the only thing a
// player sees and the one thing the markup never says.
//
// the poll is not padding: the header wrapper uses transition-all, which animates z-index
// itself (-10 -> 40 over 300ms), so the modal only wins once that has settled.
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

// the leaderboard avatars are drawn round and lifted, and at z-50 they rode over the sticky
// bar as the page scrolled past them
test("page content scrolls under the category bar, never over it", async ({ page }) => {
  await page.route("**/leaderboard**", (route) =>
    route.fulfill({
      json: {
        boardId: "b1",
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        serverTime: new Date().toISOString(),
        paidPlaces: 10,
        pool: 21700,
        prizes: [10000, 5000, 2500, 1200, 900, 700, 500, 400, 300, 200],
        standings: [1, 2, 3].map((i) => ({
          _id: `p${i}`, rank: i, points: 5000 - 1000 * i, bets: i, prize: 10000 / i,
          username: `player-${i}`, level: 10 * i, profilePicture: IMG, badge: null,
        })),
        me: null,
      },
    })
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  const bar = page.getByRole("navigation", { name: "Case categories" });
  await expect(page.getByText("player-1")).toBeVisible();

  // walk the page past the podium; at every step the bar has to own its own pixels
  for (const y of [400, 700, 1000, 1300, 1600, 1900]) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    const box = (await bar.boundingBox()) as { x: number; y: number; height: number } | null;
    if (!box) continue;
    const owner = await page.evaluate(
      ([x, py]) => {
        const el = document.elementFromPoint(x, py);
        if (!el) return "nothing";
        const nav = el.closest("nav[aria-label='Case categories']");
        return nav ? "the bar" : el.tagName + "." + String(el.className).slice(0, 40);
      },
      [box.x + 420, box.y + box.height / 2]
    );
    expect(owner, `at scrollY ${y} the bar was covered`).toBe("the bar");
  }
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

// a 1366x768 laptop is the resolution the mines board used to run off the bottom of:
// every board is sized from its width, and nothing asked how much height was left
test("a game board fits a short screen without scrolling", async ({ page }) => {
  // 768 minus the browser's own chrome is roughly what the page actually gets
  await page.setViewportSize({ width: 1366, height: 678 });

  for (const game of ["mines", "plinko", "blackjack"]) {
    await page.goto(`/${game}`);
    const shell = page.locator("div.rounded-lg.border.border-line").first();
    await expect(shell).toBeVisible();

    const box = await shell.boundingBox();
    const viewport = page.viewportSize();
    expect(
      { game, overflow: Math.max(0, Math.round(box!.y + box!.height - viewport!.height)) }
    ).toEqual({ game, overflow: 0 });
  }
});

test.describe("the today strip", () => {
  const HOUR = 3600 * 1000;

  // answers the strip's two reads and counts them; a delay holds both answers back
  const today = async (page: Page, { delay = 0, me = null as unknown } = {}) => {
    const counts = { pot: 0, board: 0 };
    const hold = () => (delay ? new Promise((resolve) => setTimeout(resolve, delay)) : Promise.resolve());
    await page.route("**/lottery/pot", async (route) => {
      if (route.request().resourceType() === "document") return route.fallback();
      counts.pot += 1;
      await hold();
      await route.fulfill({
        json: { number: 4, jackpot: 38425, drawAt: new Date(Date.now() + 5 * HOUR).toISOString(), serverTime: new Date().toISOString() },
      });
    });
    await page.route("**/leaderboard", async (route) => {
      counts.board += 1;
      await hold();
      await route.fulfill({
        json: {
          boardId: "b1",
          startsAt: new Date(Date.now() - 9 * HOUR).toISOString(),
          endsAt: new Date(Date.now() + 15 * HOUR).toISOString(),
          serverTime: new Date().toISOString(),
          paidPlaces: 10,
          pool: 21700,
          prizes: [10000, 5000, 2500, 1200, 900, 700, 500, 400, 300, 200],
          standings: [],
          me,
        },
      });
    });
    return counts;
  };

  const amount = (page: Page, card: "lottery" | "leaderboard") => page.getByTestId(`today-${card}`).getByTestId("today-amount");
  const box = async (page: Page, selector: string) => page.locator(selector).first().boundingBox();

  test("shows the open draw's jackpot and today's prize pool from one read of each", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.clock.install();
    const counts = await today(page);
    await page.goto("/");

    await expect(amount(page, "lottery")).toHaveText(/^K₽\s38,425$/);
    await expect(amount(page, "leaderboard")).toHaveText(/^K₽\s21,700$/);
    await expect(page.getByTestId("lottery-pot")).toHaveText(/^Jackpot K₽\s38,425$/);
    await expect(page.getByTestId("today-lottery").getByTestId("today-clock")).toHaveText(/^0[45]:\d\d:\d\d$/);

    expect(counts).toEqual({ pot: 1, board: 1 });

    // the board is polled every thirty seconds: one poller for the strip and the section makes it two reads, not four.
    // the clock moves a second at a time and stops at the poll, so a slow answer never meets the api layer's 2.5 s hedge
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    let seconds = 0;
    while (counts.board < 2 && seconds < 40) {
      await page.clock.runFor(1000);
      await page.waitForTimeout(300);
      seconds += 1;
    }
    expect(seconds).toBeGreaterThanOrEqual(20);
    await page.waitForTimeout(500);
    expect(counts).toEqual({ pot: 1, board: 2 });
  });

  test("the lottery card opens the lottery", async ({ page }) => {
    await today(page);
    await page.goto("/");
    await page.getByTestId("today-lottery").click();
    await expect(page).toHaveURL(/\/lottery$/);
  });

  test("the leaderboard card brings the leaderboard heading into view below the sticky bar", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await today(page);
    await page.goto("/");
    const heading = page.getByText("DAILY LEADERBOARD", { exact: true });
    await expect(heading).toBeVisible();
    // the shelves above have to be in first, or their placeholder leaving moves the heading after the scroll
    await expect(page.getByText("Starter Case")).toBeVisible();
    await expect(page.getByText("Recommended Cases")).toHaveCount(0);
    await expect(amount(page, "leaderboard")).toHaveText(/21,700/);
    expect((await heading.boundingBox())!.y).toBeGreaterThan(900);

    await page.getByTestId("today-leaderboard").click();
    const bar = page.locator("nav.sticky");
    await expect.poll(async () => (await bar.boundingBox())!.y).toBe(0);
    await expect
      .poll(
        async () => {
          const b = (await heading.boundingBox())!;
          const top = (await bar.boundingBox())!;
          return b.y >= top.y + top.height && b.y + b.height <= 900;
        },
        { timeout: 10000 }
      )
      .toBe(true);
    expect(page.url()).not.toContain("#");
  });

  test("on a laptop the cards sit half over the banner's bottom edge", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await today(page);
    await page.goto("/");
    await expect(amount(page, "lottery")).toHaveText(/38,425/);

    const banner = (await box(page, ".carousel-root"))!;
    for (const card of ["today-lottery", "today-leaderboard"]) {
      const b = (await page.getByTestId(card).boundingBox())!;
      expect(Math.round(banner.y + banner.height - b.y)).toBe(44);
      expect(b.height).toBe(88);
      // on top of the banner, not under it
      const owner = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.getAttribute("data-testid"), [b.x + b.width / 2, b.y + 10]);
      expect(owner).toBe(card);
    }
    const bar = (await box(page, "nav.sticky"))!;
    const strip = (await page.getByTestId("today-strip").boundingBox())!;
    expect(Math.round(bar.y - (strip.y + strip.height))).toBe(0);
  });

  test("on a phone the strip is the first thing under the navbar, above the category bar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await today(page);
    await page.goto("/");
    await expect(amount(page, "lottery")).toHaveText(/38,425/);

    const navbar = (await box(page, "nav.notched"))!;
    const strip = (await page.getByTestId("today-strip").boundingBox())!;
    const bar = (await box(page, "nav.sticky"))!;
    // the gap is the header's own bottom padding; the hidden banner takes no room
    expect(Math.round(strip.y - (navbar.y + navbar.height))).toBe(16);
    expect(Math.round(bar.y - (strip.y + strip.height))).toBe(0);
    const cards = [await page.getByTestId("today-lottery").boundingBox(), await page.getByTestId("today-leaderboard").boundingBox()];
    expect(cards[0]!.y).toBe(cards[1]!.y);
    expect(cards[0]!.height).toBe(cards[1]!.height);
  });

  test("no horizontal scroll at 320", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await today(page);
    await page.goto("/");
    await expect(amount(page, "leaderboard")).toHaveText(/21,700/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`nothing moves when the answers arrive at ${size.width}`, async ({ page }) => {
      await page.setViewportSize(size);
      await today(page, { delay: 2500 });
      await page.goto("/");
      await expect(page.getByTestId("today-pending").filter({ visible: true })).toHaveCount(4);
      await page.evaluate(() => document.fonts.ready);
      const before = { strip: await page.getByTestId("today-strip").boundingBox(), bar: (await box(page, "nav.sticky"))!.y };

      await expect(amount(page, "lottery")).toHaveText(/38,425/);
      await expect(page.getByTestId("today-leaderboard").getByTestId("today-clock")).toBeVisible();
      const after = { strip: await page.getByTestId("today-strip").boundingBox(), bar: (await box(page, "nav.sticky"))!.y };
      expect(after).toEqual(before);
    });
  }

  test("a ranked player sees their place on the leaderboard card", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockApi(page);
    await mockSession(page);
    await today(page, { me: { _id: "player1", points: 900, bets: 3, rank: 12, toPaidPlace: 400, prize: 0 } });
    await page.goto("/");
    await expect(page.getByTestId("today-leaderboard").getByText("You #12").filter({ visible: true })).toHaveCount(1);
    await expect(page.getByTestId("today-lottery").getByText(/You #/)).toHaveCount(0);
    // a phone shows the place alone, down to the narrowest one
    for (const width of [390, 360, 320]) {
      await page.setViewportSize({ width, height: 740 });
      await expect(page.getByTestId("today-leaderboard").getByText("#12", { exact: true }).filter({ visible: true })).toHaveCount(1);
      await expect(page.getByTestId("today-leaderboard").getByText("You #12").filter({ visible: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  });
});
