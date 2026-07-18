export type PlinkoRisk = "low" | "medium" | "high";

export const RISKS: PlinkoRisk[] = ["low", "medium", "high"];

export const ROWS = 16;
export const BINS = ROWS + 1;

// display copy of the server payout tables; the server stays authoritative for money
const mirror = (half: number[]) => [...half, ...half.slice(0, -1).reverse()];
export const PAYOUT_MULTIPLIERS: Record<PlinkoRisk, number[]> = {
  low: mirror([15, 8, 2.2, 1.6, 1.3, 1.1, 1.05, 0.95, 0.6]),
  medium: mirror([100, 40, 9, 5, 2.9, 1.4, 1, 0.5, 0.3]),
  high: mirror([1000, 120, 25, 9, 4, 1.7, 0.3, 0.2, 0.2]),
};

// per-risk bet ceilings keep the top payout at the max win (cap times top multiplier)
export const MAX_BET: Record<PlinkoRisk, number> = { low: 50000, medium: 10000, high: 1000 };
export const MAX_WIN = 1000000;

// board geometry in viewBox units; the svg scales it to any container width
export const BOARD_W = 1000;
export const BOARD_H = 900;
const CENTER_X = BOARD_W / 2;
const PEG_SPACING = 52;
const ROW_GAP = 46;
const TOP_Y = 110;
const DROP_Y = 30;
const CONTACT_LIFT = 15; // ball center sits a radius above the peg it strikes
const HOP_LIFT = 16;

export const PEG_RADIUS = 5;
export const BALL_RADIUS = 10;
export const BIN_Y = 830;
export const BIN_W = PEG_SPACING - 6;
export const BIN_H = 46;
export const DROP_DURATION_S = 3.1;

export const pegRows = (): { x: number; y: number }[][] => {
  const rows: { x: number; y: number }[][] = [];
  for (let row = 0; row < ROWS; row++) {
    const pegs: { x: number; y: number }[] = [];
    for (let k = 0; k < row + 3; k++) {
      pegs.push({
        x: CENTER_X + (k - (row + 2) / 2) * PEG_SPACING,
        y: TOP_Y + row * ROW_GAP,
      });
    }
    rows.push(pegs);
  }
  return rows;
};

export const binCenterX = (bin: number) => CENTER_X + (bin - ROWS / 2) * PEG_SPACING;

// waypoints the ball passes through for a server path: a contact above each row's peg,
// a bounce arc toward the side it deflects to, then the mouth of the landing bin.
// falls ease in and bounces ease out so the motion reads as gravity; `rand` adds a
// per-ball wobble to the arc peaks without ever moving a contact point or the bin
export const ballKeyframes = (path: string, rand: () => number = () => 0.5) => {
  const xs: number[] = [CENTER_X];
  const ys: number[] = [DROP_Y];
  const weights: number[] = [];
  const eases: string[] = [];
  const hits: { row: number; index: number; t: number }[] = [];
  let offset = 0; // in half-spacings from the center line

  for (let row = 0; row < ROWS; row++) {
    const contactX = CENTER_X + (offset * PEG_SPACING) / 2;
    const contactY = TOP_Y + row * ROW_GAP - CONTACT_LIFT;
    xs.push(contactX);
    ys.push(contactY);
    weights.push(row === 0 ? 1.3 : 0.55);
    eases.push("easeIn");
    hits.push({ row, index: (offset + row + 2) / 2, t: 0 });

    const dir = path[row] === "R" ? 1 : -1;
    offset += dir;
    xs.push(contactX + dir * PEG_SPACING * 0.3 + (rand() - 0.5) * 6);
    ys.push(contactY - HOP_LIFT + (rand() - 0.5) * 8);
    weights.push(0.45);
    eases.push("easeOut");
  }

  const bin = path.split("R").length - 1;
  xs.push(binCenterX(bin));
  ys.push(BIN_Y + BIN_H / 2);
  weights.push(0.9);
  eases.push("easeIn");

  const total = weights.reduce((sum, w) => sum + w, 0);
  let acc = 0;
  const times = [0, ...weights.map((w) => (acc += w) / total)];
  hits.forEach((h, i) => {
    h.t = times[1 + 2 * i];
  });

  return { xs, ys, times, eases, bin, hits };
};

// bin fills fade from blue at the center to gold at the rims
const BIN_COLORS = [
  "#3B82F6",
  "#4F6EF0",
  "#6D5CE7",
  "#8B4ADF",
  "#A93BC9",
  "#C433A0",
  "#DF3D6E",
  "#F25C3F",
  "#FFCC00",
];

export const binColor = (bin: number) => BIN_COLORS[Math.abs(bin - ROWS / 2)];
export const binTextColor = (bin: number) => (Math.abs(bin - ROWS / 2) >= 7 ? "#151225" : "#ffffff");

export const formatMultiplier = (multiplier: number) => `x${multiplier}`;
