const gamesRoutes = require("../../routes/gamesRoutes");
const { oneAtATime } = require("../../middleware/oneAtATime");

const io = { to: () => ({ emit: () => {} }), emit: () => {} };
const router = gamesRoutes(io);
const handlers = (path) => {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods.post);
  return layer.route.stack.map((s) => s.handle);
};

describe("the bet line", () => {
  it.each(["/openCase/:id", "/upgrade", "/slots", "/plinko", "/dice", "/blackjack/deal", "/mines/start", "/hilo/start"])(
    "%s waits in the player's one line, whatever the game",
    (path) => {
      expect(handlers(path)).toContain(oneAtATime);
    }
  );

  it.each(["/blackjack/hit", "/blackjack/double", "/mines/reveal", "/mines/cashout", "/hilo/guess", "/hilo/cashout"])(
    "%s is a move inside a round, so it never waits for the next bet's turn",
    (path) => {
      expect(handlers(path)).not.toContain(oneAtATime);
    }
  );
});
