import { Page } from "@playwright/test";

// the suite runs against the built bundle with no backend behind it. a spec that forgets
// to stub these does not fail loudly: the calls hang, the page never settles, and whatever
// it was asserting about the layout is measured on a half rendered screen. that is exactly
// how the chat rail spec passed on a laptop with a dev server running and failed on CI.
export async function mockApi(page: Page) {
  const cases = [
    { _id: "c1", title: "Touhou Case 1", image: "/images/cards/marisa.webp", price: 100, category: "Touhou" },
    { _id: "c2", title: "Touhou Case 2", image: "/images/cards/reimu.webp", price: 250, category: "Touhou" },
  ];

  await page.route("**/cases**", (route) => route.fulfill({ json: cases }));
  // registered after the catch-all so it wins: playwright matches newest route first
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
  await page.route("**/ranking**", (route) => route.fulfill({ json: { ranking: 0, users: [] } }));
  await page.route("**/marketplace**", (route) =>
    route.fulfill({ json: { totalPages: 0, currentPage: 1, items: [] } })
  );
  await page.route("**/items**", (route) => route.fulfill({ json: { totalPages: 0, items: [] } }));
  await page.route("**/collections**", (route) => route.fulfill({ json: [] }));
  await page.route("**/missions**", (route) => route.fulfill({ json: { missions: [] } }));
  await page.route("**/gift/**", (route) => route.fulfill({ json: {} }));

  // discord's own widget endpoint, which is not ours and is not reachable from a runner
  await page.route("https://discord.com/**", (route) => route.abort());
}
