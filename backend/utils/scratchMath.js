// pure scratch card math: one ticket is one nonce, and everything on it comes from the seed. the purchase, the treasure
// picks and the verifier all fold through these functions, so they can never disagree.
const { rollFloat } = require("./provablyFair");

const SCRATCH_ALGO_VERSION = 1;

// a million equally likely slots per ticket, so every chance is an integer count and every return an exact sum
const SLOTS = 1000000;
const MAX_QUANTITY = 10;

// the eight lines of a 3x3 grid: rows, columns, then the two diagonals
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

// every table is walked from its last row up, so slot 0 is always the rarest row and a slot past the table is a loss
const TICKETS = {
  // match 3 in a line: [symbol, multiplier, slots]; sums multiplier * slots to 960,000
  pocket: {
    kind: "line",
    price: 10,
    prizes: [["star", 1, 220000], ["clover", 2, 110000], ["coins", 5, 44000], ["gem", 10, 15000], ["chest", 25, 4000], ["crown", 100, 500]],
    // how often each symbol fills a cell off the winning line, so a crown on the grid stays as rare as it pays
    fillers: { star: 30, clover: 25, coins: 20, gem: 13, chest: 8, crown: 4 },
  },
  // lucky symbols: [slots, matched prizes in multiples of the price, multiplier]; sums pays * slots to 960,000
  nine: {
    kind: "lucky",
    price: 100,
    pool: ["nine", "snowflake", "frog", "star", "heart", "flame", "gem", "clover", "crown", "coins"],
    printable: [1, 2, 5, 10, 25, 50, 100, 1000],
    // a decoy's prize, weighted per printable prize, so a losing ticket rarely dangles the 1000x
    decoyWeights: [30, 25, 18, 12, 7, 4, 3, 1],
    lossMultipliers: [1, 1, 1, 1, 2, 2, 3, 9],
    outcomes: [
      [199000, [1], 1], [50000, [2], 1], [20000, [1, 1], 1], [10000, [1], 2], [10000, [1], 3], [10000, [2, 1], 1],
      [14000, [5], 1], [10000, [2, 2, 1], 1], [10000, [1], 9], [5000, [10], 1], [3000, [5], 2], [2000, [2], 9],
      [2400, [25], 1], [600, [5], 9], [300, [100], 1], [200, [50], 2], [20, [100], 9], [60, [1000], 1],
    ],
  },
  // scratch 3 of 9: [slots, the non-empty finds in K₽]; every board is a win of something, the picks decide how much
  treasure: {
    kind: "pick",
    price: 1000,
    maxQuantity: 1,
    picks: 3,
    finds: { mushroom: 500, star: 1000, potion: 2500, book: 10000, hakkero: 100000 },
    boards: [
      [254625, [500, 500]],
      [250000, [500, 500, 500]],
      [200000, [1000, 500, 500]],
      [155375, [1000, 1000, 500, 500]],
      [70000, [2500, 1000, 500]],
      [40000, [2500, 2500, 1000, 500, 500]],
      [20000, [10000, 1000, 500, 500]],
      [7000, [10000, 10000, 2500, 1000, 500]],
      [2500, [100000, 2500, 1000, 500]],
      [500, [100000, 100000, 100000, 10000, 2500]],
    ],
  },
};

const POCKET_CELLS = 9;
const NINE_SPOTS = 8;
const TREASURE_CELLS = 9;

// pocket cursors: 0 the prize, 1 the winning line, 2 + c the filler of cell c
const LINE_CURSOR = 1;
const CELL_CURSOR = 2;
// nine cursors: 0 the outcome, 1 and 2 the lucky symbols, 3 a losing ticket's multiplier, 4..10 the spot shuffle,
// then two per spot: 11 + 2p its symbol and 12 + 2p a decoy's prize
const LUCKY_CURSOR = 1;
const LOSS_MULT_CURSOR = 3;
const SPOT_SHUFFLE_CURSOR = 4;
const SPOT_CURSOR = 11;
// treasure cursors: 0 the board, 1..8 the shuffle of the nine spots
const BOARD_SHUFFLE_CURSOR = 1;

const isTicket = (ticketId) => typeof ticketId === "string" && Object.prototype.hasOwnProperty.call(TICKETS, ticketId);
const maxQuantityOf = (ticketId) => TICKETS[ticketId].maxQuantity || MAX_QUANTITY;
const validQuantity = (ticketId, quantity) => Number.isInteger(quantity) && quantity >= 1 && quantity <= maxQuantityOf(ticketId);
const isStateful = (ticketId) => isTicket(ticketId) && TICKETS[ticketId].kind === "pick";

const slotFromFloat = (float) => Math.floor(float * SLOTS);
const pick = (list, float) => list[Math.floor(float * list.length)];

// one of `list` by integer weights: the float picks a unit of the total and the walk finds whose share it falls in
function weightedPick(list, weights, float) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  const unit = Math.floor(float * total);
  let edge = 0;
  for (let i = 0; i < list.length; i++) {
    edge += weights[i];
    if (unit < edge) return list[i];
  }
  return list[list.length - 1];
}

// the row index a slot lands on, walked from the last row up, or -1 for a loss
function rowForSlot(rows, slotsOf, slot) {
  let edge = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    edge += slotsOf(rows[i]);
    if (slot < edge) return i;
  }
  return -1;
}

const ninePays = ([, matched, multiplier]) => multiplier * matched.reduce((sum, m) => sum + m, 0);
const boardSum = ([, finds]) => finds.reduce((sum, f) => sum + f, 0);

// sum of (pays in multiples of the price) * slots, so 960,000 is a 96% return; treasure counts what three picks take on average
function returnSlots(ticketId) {
  const t = TICKETS[ticketId];
  if (t.kind === "line") return t.prizes.reduce((sum, [, m, slots]) => sum + m * slots, 0);
  if (t.kind === "lucky") return t.outcomes.reduce((sum, row) => sum + ninePays(row) * row[0], 0);
  return t.boards.reduce((sum, row) => sum + row[0] * boardSum(row), 0) * t.picks / TREASURE_CELLS / t.price;
}

const choose = (n, k) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};

// every way to choose k of n cells, in ascending order
function spotChoices(n, k, from = 0) {
  if (k === 0) return [[]];
  const out = [];
  for (let c = from; c <= n - k; c++) for (const rest of spotChoices(n, k - 1, c + 1)) out.push([c, ...rest]);
  return out;
}

// paying the price back or more, as [numerator, denominator]. treasure counts the three-spot choices of every board that
// reach the price, since a lone 500 find on a 1,000 ticket is still a loss
function winOdds(ticketId) {
  const t = TICKETS[ticketId];
  if (t.kind === "line") return [t.prizes.reduce((sum, [, m, slots]) => sum + (m >= 1 ? slots : 0), 0), SLOTS];
  if (t.kind === "lucky") return [t.outcomes.reduce((sum, row) => sum + (ninePays(row) >= 1 ? row[0] : 0), 0), SLOTS];
  const choices = spotChoices(TREASURE_CELLS, t.picks);
  const wins = t.boards.reduce((sum, [slots, finds]) => {
    const board = [...finds, ...Array(TREASURE_CELLS - finds.length).fill(0)];
    return sum + slots * choices.filter((picks) => treasurePayout(board, picks) >= t.price).length;
  }, 0);
  return [wins, choices.length * SLOTS];
}

function topPayout(ticketId) {
  const t = TICKETS[ticketId];
  if (t.kind === "line") return t.price * Math.max(...t.prizes.map(([, m]) => m));
  if (t.kind === "lucky") return t.price * Math.max(...t.outcomes.map(ninePays));
  return Math.max(...t.boards.map(([, finds]) => [...finds].sort((a, b) => b - a).slice(0, t.picks).reduce((s, f) => s + f, 0)));
}

// the symbols that cannot go in `cell` without finishing a line of three with the two cells already filled
function blockedAt(cells, cell) {
  const blocked = new Set();
  for (const line of LINES) {
    if (!line.includes(cell)) continue;
    const [a, b] = line.filter((c) => c !== cell);
    if (cells[a] && cells[a] === cells[b]) blocked.add(cells[a]);
  }
  return blocked;
}

// the symbols a filler may take at `cell`: every one that would not finish a line there
const allowedAt = (cells, cell) => {
  const blocked = blockedAt(cells, cell);
  return TICKETS.pocket.prizes.map(([symbol]) => symbol).filter((s) => !blocked.has(s));
};

// a winning ticket puts its symbol on one of the eight lines; every other cell, in cell order, draws by weight from the
// symbols that would not finish a line there. at most four lines cross a cell against six symbols, so it never runs dry
function resolvePocket(draw) {
  const t = TICKETS.pocket;
  const slot = slotFromFloat(draw(0));
  const row = rowForSlot(t.prizes, ([, , slots]) => slots, slot);
  const cells = Array(POCKET_CELLS).fill(null);
  let line = null;
  let symbol = null;
  let multiplier = 0;
  if (row >= 0) {
    [symbol, multiplier] = t.prizes[row];
    line = LINES[Math.floor(draw(LINE_CURSOR) * LINES.length)];
    for (const c of line) cells[c] = symbol;
  }
  for (let c = 0; c < POCKET_CELLS; c++) {
    if (cells[c]) continue;
    const allowed = allowedAt(cells, c);
    cells[c] = weightedPick(allowed, allowed.map((s) => t.fillers[s]), draw(CELL_CURSOR + c));
  }
  return { ticketId: "pocket", price: t.price, slot, symbol, multiplier, payout: multiplier * t.price, cells, line, winningCells: line ? [...line] : [] };
}

// the outcome first, then a board that shows it: the matched prizes sit on the first shuffled spots under a lucky symbol,
// every other spot shows a non-lucky symbol (uniform) and a printable prize (by the decoy weights)
function resolveNine(draw) {
  const t = TICKETS.nine;
  const slot = slotFromFloat(draw(0));
  const row = rowForSlot(t.outcomes, ([slots]) => slots, slot);
  const first = pick(t.pool, draw(LUCKY_CURSOR));
  const second = pick(t.pool.filter((s) => s !== first), draw(LUCKY_CURSOR + 1));
  const lucky = [first, second];
  const others = t.pool.filter((s) => !lucky.includes(s));
  const matched = row >= 0 ? t.outcomes[row][1] : [];
  const multiplier = row >= 0 ? t.outcomes[row][2] : pick(t.lossMultipliers, draw(LOSS_MULT_CURSOR));

  const order = Array.from({ length: NINE_SPOTS }, (_, i) => i);
  for (let i = NINE_SPOTS - 1; i > 0; i--) {
    const j = Math.floor(draw(SPOT_SHUFFLE_CURSOR + (NINE_SPOTS - 1 - i)) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const prizeOf = new Map(matched.map((m, k) => [order[k], m]));
  const spots = Array.from({ length: NINE_SPOTS }, (_, p) => {
    if (prizeOf.has(p)) return { symbol: pick(lucky, draw(SPOT_CURSOR + 2 * p)), prize: prizeOf.get(p) * t.price };
    return { symbol: pick(others, draw(SPOT_CURSOR + 2 * p)), prize: weightedPick(t.printable, t.decoyWeights, draw(SPOT_CURSOR + 2 * p + 1)) * t.price };
  });
  const winningSpots = [...prizeOf.keys()].sort((a, b) => a - b);
  const matchedSum = matched.reduce((sum, m) => sum + m, 0);
  return {
    ticketId: "nine",
    price: t.price,
    slot,
    lucky,
    multiplier,
    spots,
    winningSpots,
    payout: multiplier * matchedSum * t.price,
  };
}

// the board's finds then its empties, in table order, dealt over the nine spots by a seeded fisher-yates
function resolveTreasure(draw) {
  const t = TICKETS.treasure;
  const slot = slotFromFloat(draw(0));
  const row = rowForSlot(t.boards, ([slots]) => slots, slot);
  const finds = t.boards[row][1];
  const board = [...finds, ...Array(TREASURE_CELLS - finds.length).fill(0)];
  for (let i = TREASURE_CELLS - 1; i > 0; i--) {
    const j = Math.floor(draw(BOARD_SHUFFLE_CURSOR + (TREASURE_CELLS - 1 - i)) * (i + 1));
    [board[i], board[j]] = [board[j], board[i]];
  }
  return { ticketId: "treasure", price: t.price, slot, row, board };
}

const treasurePayout = (board, picks) => picks.reduce((sum, cell) => sum + board[cell], 0);
const findSymbol = (amount) => Object.keys(TICKETS.treasure.finds).find((name) => TICKETS.treasure.finds[name] === amount) || null;
const validCell = (cell) => Number.isInteger(cell) && cell >= 0 && cell < TREASURE_CELLS;

// a whole ticket from a float provider (cursor -> [0,1)), so the tests can feed it anything
function resolveWith(draw, ticketId) {
  const kind = TICKETS[ticketId].kind;
  if (kind === "line") return resolvePocket(draw);
  if (kind === "lucky") return resolveNine(draw);
  return resolveTreasure(draw);
}

const resolveTicket = (serverSeed, clientSeed, nonce, ticketId) =>
  resolveWith((cursor) => rollFloat(serverSeed, clientSeed, nonce, cursor), ticketId);

module.exports = {
  SCRATCH_ALGO_VERSION,
  SLOTS,
  MAX_QUANTITY,
  LINES,
  TICKETS,
  TREASURE_CELLS,
  isTicket,
  isStateful,
  maxQuantityOf,
  validQuantity,
  validCell,
  slotFromFloat,
  rowForSlot,
  returnSlots,
  winOdds,
  topPayout,
  choose,
  weightedPick,
  blockedAt,
  allowedAt,
  resolveWith,
  resolveTicket,
  treasurePayout,
  findSymbol,
};
